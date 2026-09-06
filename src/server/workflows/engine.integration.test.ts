// 工作流引擎集成测试（需要 docker compose 的 Postgres + Redis）
// 使用 fake provider，不消耗 token
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.MODEL_PROVIDER = "fake";
// 独立队列前缀：避免 dev worker 消费测试 job 导致竞态
process.env.QUEUE_PREFIX = `test-${Date.now()}`;

const hasInfra =
  process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

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

    await checkpointService.decideCheckpoint(ctx, checkpoint!.id, "approved", "已核对策略内容，批准执行");
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

    // Agent 监测链路保留 Prompt 快照与逐次模型调用
    const agentRun = await prisma.agentRun.findFirst({
      where: { tenantId: orgId, workflowRunId: run.id, agentKey: "strategy" },
      include: { calls: { orderBy: { createdAt: "asc" } } },
    });
    expect(agentRun?.status).toBe("completed");
    expect(agentRun?.promptSnapshot).toMatchObject({
      system: expect.any(String),
      user: expect.any(String),
    });
    expect(agentRun?.calls).toHaveLength(1);
    expect(agentRun?.calls[0]).toMatchObject({
      phase: "primary",
      attempt: 1,
      status: "completed",
      provider: "fake",
      model: "fake-model",
    });
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

  it("孤儿队列任务：DB reset 后残留 job 不会打崩 worker", async () => {
    const staleRunId = crypto.randomUUID();
    await expect(engine.executeStep(orgId, staleRunId, "gather_context")).resolves.toBeUndefined();
    await expect(
      engine.onStepFailed(orgId, staleRunId, "gather_context", "workflow run 不存在"),
    ).resolves.toBeUndefined();
  });

  it("运行中取消：步骤迟到成功或失败都不能覆盖 cancelled 终态", async () => {
    const ctx = { orgId, userId };
    const workflowKey = `cancel-race-${Date.now()}`;
    let releaseStep: (() => void) | undefined;
    let markStepEntered: (() => void) | undefined;
    const stepGate = new Promise<void>((resolve) => {
      releaseStep = resolve;
    });
    const stepEntered = new Promise<void>((resolve) => {
      markStepEntered = resolve;
    });
    engine.registerWorkflow({
      key: workflowKey,
      label: "取消竞态测试",
      steps: [
        {
          key: "slow_step",
          label: "慢步骤",
          run: async () => {
            markStepEntered?.();
            await stepGate;
            return { late: true };
          },
        },
      ],
    });

    const run = await engine.startWorkflow(ctx, { key: workflowKey });
    const execution = engine.executeStep(orgId, run.id, "slow_step");
    await stepEntered;

    await engine.cancelWorkflow(ctx, run.id);
    releaseStep?.();
    await execution;
    await engine.onStepFailed(orgId, run.id, "slow_step", "迟到失败回调");

    const state = await prisma.workflowRun.findUnique({
      where: { id: run.id },
      include: { steps: true },
    });
    expect(state?.status).toBe("cancelled");
    expect(state?.steps[0]?.status).toBe("skipped");
    expect(state?.steps[0]?.output).toEqual({});
    expect(state?.failureReason).toBe("用户取消工作流");
  });

  it("等待审批时取消：关闭待审批点并跳过等待步骤", async () => {
    const ctx = { orgId, userId };
    const run = await engine.startWorkflow(ctx, {
      key: "strategy",
      subjectType: "campaign",
      subjectId: campaignId,
    });
    await engine.executeStep(orgId, run.id, "gather_context");
    await engine.executeStep(orgId, run.id, "generate_strategy");

    await engine.cancelWorkflow(ctx, run.id);

    const state = await prisma.workflowRun.findUnique({
      where: { id: run.id },
      include: { steps: true, checkpoints: true },
    });
    expect(state?.status).toBe("cancelled");
    expect(state?.steps.find((step) => step.stepKey === "generate_strategy")?.status).toBe(
      "skipped",
    );
    expect(state?.checkpoints[0]?.status).toBe("rejected");
    expect(state?.checkpoints[0]?.decisionReason).toBe("用户取消工作流");
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

  it("安全步骤失败后创建新运行，旧终态不变且重复请求幂等", async () => {
    const ctx = { orgId, userId };
    const workflowKey = `safe-retry-${Date.now()}`;
    engine.registerWorkflow({
      key: workflowKey,
      label: "安全重试测试",
      manualRetrySafeStepKeys: ["generate"],
      steps: [
        {
          key: "generate",
          label: "纯生成步骤",
          run: async () => {
            throw new Error("模拟生成失败");
          },
        },
      ],
    });

    const source = await engine.startWorkflow(ctx, { key: workflowKey });
    await expect(engine.executeStep(orgId, source.id, "generate")).rejects.toThrow("模拟生成失败");
    await engine.onStepFailed(orgId, source.id, "generate", "模拟生成失败");

    const retried = await engine.retryWorkflow(ctx, source.id);
    const repeated = await engine.retryWorkflow(ctx, source.id);
    expect(repeated.id).toBe(retried.id);
    expect(retried.id).not.toBe(source.id);

    const [sourceState, retriedState] = await Promise.all([
      prisma.workflowRun.findUnique({ where: { id: source.id } }),
      prisma.workflowRun.findUnique({ where: { id: retried.id }, include: { steps: true } }),
    ]);
    expect(sourceState?.status).toBe("failed");
    expect(sourceState?.completedAt).not.toBeNull();
    expect(retriedState?.retryOfRunId).toBe(source.id);
    expect(retriedState?.status).toBe("queued");
    expect(retriedState?.steps).toEqual([
      expect.objectContaining({ stepKey: "generate", status: "pending", attempt: 0 }),
    ]);
  });

  it("可能产生业务副作用的失败步骤禁止直接重试", async () => {
    const ctx = { orgId, userId };
    const workflowKey = `unsafe-retry-${Date.now()}`;
    engine.registerWorkflow({
      key: workflowKey,
      label: "危险重试测试",
      manualRetrySafeStepKeys: [],
      steps: [
        {
          key: "apply",
          label: "落库步骤",
          run: async () => {
            throw new Error("模拟落库失败");
          },
        },
      ],
    });

    const source = await engine.startWorkflow(ctx, { key: workflowKey });
    await expect(engine.executeStep(orgId, source.id, "apply")).rejects.toThrow("模拟落库失败");
    await engine.onStepFailed(orgId, source.id, "apply", "模拟落库失败");

    await expect(engine.retryWorkflow(ctx, source.id)).rejects.toMatchObject({
      code: "WORKFLOW_NOT_RESUMABLE",
    });
    expect(
      await prisma.workflowRun.count({ where: { tenantId: orgId, retryOfRunId: source.id } }),
    ).toBe(0);
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
