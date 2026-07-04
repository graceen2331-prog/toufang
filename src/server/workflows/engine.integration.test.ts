// 工作流引擎集成测试（需要 docker compose 的 Postgres + Redis）
// 使用 fake provider，不消耗 token
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.MODEL_PROVIDER = "fake";

const hasInfra = !!process.env.DATABASE_URL;

describe.skipIf(!hasInfra)("工作流引擎（集成）", () => {
  let prisma: (typeof import("@/server/db/client"))["prisma"];
  let engine: typeof import("@/server/workflows/engine");
  let checkpointService: typeof import("@/server/modules/checkpoint/checkpoint.service");
  let orgId: string;
  let userId: string;
  let campaignId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db/client"));
    engine = await import("@/server/workflows/engine");
    checkpointService = await import("@/server/modules/checkpoint/checkpoint.service");

    // 独立测试组织，避免污染演示数据
    const org = await prisma.organization.create({
      data: { name: "引擎测试组织", slug: `engine-test-${Date.now()}`, aiMonthlyBudgetCents: 100000 },
    });
    orgId = org.id;
    const user = await prisma.user.create({
      data: { email: `engine-test-${Date.now()}@test.dev`, name: "测试员", passwordHash: "x" },
    });
    userId = user.id;
    const brand = await prisma.brand.create({
      data: { tenantId: orgId, name: "测试品牌", slug: "test-brand", createdBy: userId },
    });
    const campaign = await prisma.campaign.create({
      data: { tenantId: orgId, brandId: brand.id, name: "引擎测试 Campaign", createdBy: userId },
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    // 引擎测试数据保留 tenant 隔离即可，不做物理清理（append-only 表禁止删除）
    await prisma.$disconnect();
  });

  it("完整链路：启动 → 步骤执行 → 审批暂停 → 批准 → 完成落库", async () => {
    const ctx = { orgId, userId };
    const run = await engine.startWorkflow(ctx, {
      key: "strategy",
      subjectType: "campaign",
      subjectId: campaignId,
    });
    expect(run.status).toBe("queued");

    await engine.executeStep(orgId, run.id, "gather_context");
    await engine.executeStep(orgId, run.id, "generate_strategy");

    let state = await prisma.workflowRun.findUnique({ where: { id: run.id } });
    expect(state?.status).toBe("waiting_for_human");

    const checkpoint = await prisma.humanCheckpoint.findFirst({
      where: { workflowRunId: run.id, status: "pending" },
    });
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.type).toBe("strategy");

    await checkpointService.decideCheckpoint(ctx, checkpoint!.id, "approved");
    await engine.executeStep(orgId, run.id, "apply_strategy");

    state = await prisma.workflowRun.findUnique({ where: { id: run.id } });
    expect(state?.status).toBe("completed");

    const version = await prisma.campaignStrategyVersion.findFirst({
      where: { tenantId: orgId, campaignId },
      orderBy: { version: "desc" },
    });
    expect(version?.status).toBe("approved");
    expect(version?.aiGenerated).toBe(true);
    expect(version?.promptKey).toBe("strategy.generate");

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    expect(campaign?.status).toBe("strategy");

    // AI 用量已记账
    const usage = await prisma.aiUsageEvent.count({ where: { tenantId: orgId } });
    expect(usage).toBeGreaterThan(0);
  });

  it("步骤幂等：completed 步骤重复执行是 no-op", async () => {
    const run = await prisma.workflowRun.findFirst({
      where: { tenantId: orgId, workflowKey: "strategy", status: "completed" },
    });
    expect(run).not.toBeNull();
    const before = await prisma.workflowStep.findFirst({
      where: { runId: run!.id, stepKey: "gather_context" },
    });
    await engine.executeStep(orgId, run!.id, "gather_context"); // 不应抛错也不应改状态
    const after = await prisma.workflowStep.findFirst({
      where: { runId: run!.id, stepKey: "gather_context" },
    });
    expect(after?.attempt).toBe(before?.attempt);
    expect(after?.status).toBe("completed");
  });

  it("审批驳回：run 终止且必须填原因", async () => {
    const ctx = { orgId, userId };
    const run = await engine.startWorkflow(ctx, {
      key: "strategy",
      subjectType: "campaign",
      subjectId: campaignId,
    });
    await engine.executeStep(orgId, run.id, "gather_context");
    await engine.executeStep(orgId, run.id, "generate_strategy");

    const checkpoint = await prisma.humanCheckpoint.findFirst({
      where: { workflowRunId: run.id, status: "pending" },
    });

    // 不填原因驳回 → 校验失败
    await expect(
      checkpointService.decideCheckpoint(ctx, checkpoint!.id, "rejected"),
    ).rejects.toThrow();

    await checkpointService.decideCheckpoint(ctx, checkpoint!.id, "rejected", "策略预算分配不合理");

    const state = await prisma.workflowRun.findUnique({ where: { id: run.id } });
    expect(state?.status).toBe("cancelled");
    expect(state?.failureReason).toContain("策略预算分配不合理");

    // 已决策的审批不可重复决策
    await expect(
      checkpointService.decideCheckpoint(ctx, checkpoint!.id, "approved"),
    ).rejects.toThrow();
  });

  it("租户隔离：其他组织无法操作本组织的工作流", async () => {
    const otherOrg = await prisma.organization.create({
      data: { name: "隔离测试组织", slug: `engine-iso-${Date.now()}` },
    });
    const run = await prisma.workflowRun.findFirst({ where: { tenantId: orgId } });
    await expect(
      engine.cancelWorkflow({ orgId: otherOrg.id, userId }, run!.id),
    ).rejects.toThrow();
  });
});
