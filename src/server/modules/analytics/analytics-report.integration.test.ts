import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasInfra =
  process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasInfra)("正式报告版本与导出完整性（集成）", () => {
  let prisma: (typeof import("@/server/db/client"))["prisma"];
  let analyticsRepository: (typeof import("./analytics.repository"))["analyticsRepository"];
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db/client"));
    ({ analyticsRepository } = await import("./analytics.repository"));
    const suffix = Date.now();
    const org = await prisma.organization.create({
      data: { name: "报告完整性测试组织", slug: `report-integrity-${suffix}` },
    });
    orgId = org.id;
    const user = await prisma.user.create({
      data: { email: `report-integrity-${suffix}@test.dev`, name: "报告测试员", passwordHash: "x" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("CAS 保存、原子审批、修订派生与追加式导出形成完整链路", async () => {
    const ctx = { orgId, userId };
    const root = await analyticsRepository.createReport(ctx, {
      title: "正式复盘报告",
      kind: "campaign_retro",
      status: "draft",
      content: { executive_summary: "初稿", narrative: "事实与结论" },
      aiGenerated: false,
    });
    expect(root.seriesId).toBe(root.id);
    expect(root.version).toBe(1);

    const saves = await Promise.all([
      analyticsRepository.updateDraftReport(ctx, root.id, 0, { title: "并发保存 A" }),
      analyticsRepository.updateDraftReport(ctx, root.id, 0, { title: "并发保存 B" }),
    ]);
    expect(saves.filter(Boolean)).toHaveLength(1);
    expect(saves.filter((item) => item === null)).toHaveLength(1);

    const saved = await analyticsRepository.findReport(ctx, root.id);
    expect(saved?.lockVersion).toBe(1);
    const submitted = await analyticsRepository.submitReportForReview(ctx, root.id, 1);
    expect(submitted.kind).toBe("submitted");
    const checkpoint = await prisma.humanCheckpoint.findFirst({
      where: { tenantId: orgId, type: "report", entityType: "report", entityId: root.id },
    });
    expect(checkpoint?.status).toBe("pending");

    const decided = await analyticsRepository.decideReportCheckpoint({
      ctx,
      checkpointId: checkpoint!.id,
      reportId: root.id,
      decision: "approved",
      reason: null,
    });
    expect(decided.kind).toBe("decided");
    const approved = await analyticsRepository.findReport(ctx, root.id);
    expect(approved?.status).toBe("approved");
    expect(approved?.approvedSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await prisma.humanCheckpoint.findUnique({ where: { id: checkpoint!.id } }),
    ).toMatchObject({ status: "approved", decidedBy: userId });

    await expect(
      prisma.report.update({ where: { id: root.id }, data: { title: "绕过应用篡改" } }),
    ).rejects.toThrow(/正式报告版本不可修改/);

    const derived = await analyticsRepository.deriveReportDraft(ctx, root.id, "补充渠道数据");
    const repeatedDerive = await analyticsRepository.deriveReportDraft(ctx, root.id, "重复点击");
    expect(derived.kind).toBe("created");
    expect(repeatedDerive.kind).toBe("created");
    if (derived.kind !== "created" || repeatedDerive.kind !== "created") return;
    expect(repeatedDerive.report.id).toBe(derived.report.id);
    expect(derived.report).toMatchObject({
      seriesId: root.id,
      version: 2,
      supersedesId: root.id,
      status: "draft",
      approvedAt: null,
      approvedSnapshotHash: null,
    });

    const firstExport = await analyticsRepository.createReportExport({
      ctx,
      reportId: root.id,
      format: "json_snapshot",
      recipient: "内部存档",
      purpose: "集成测试",
      idempotencyKey: `export-${root.id}`,
    });
    const repeatedExport = await analyticsRepository.createReportExport({
      ctx,
      reportId: root.id,
      format: "json_snapshot",
      recipient: "内部存档",
      purpose: "集成测试",
      idempotencyKey: `export-${root.id}`,
    });
    expect(firstExport.kind).toBe("created");
    expect(repeatedExport.kind).toBe("created");
    if (firstExport.kind !== "created" || repeatedExport.kind !== "created") return;
    expect(repeatedExport.exportRecord.id).toBe(firstExport.exportRecord.id);
    expect((await analyticsRepository.findReport(ctx, root.id))?.status).toBe("exported");

    const concurrentIdempotencyKey = `concurrent-export-${root.id}`;
    const [concurrentExportA, concurrentExportB] = await Promise.all([
      analyticsRepository.createReportExport({
        ctx,
        reportId: root.id,
        format: "json_snapshot",
        recipient: "内部存档",
        purpose: "并发幂等测试",
        idempotencyKey: concurrentIdempotencyKey,
      }),
      analyticsRepository.createReportExport({
        ctx,
        reportId: root.id,
        format: "json_snapshot",
        recipient: "内部存档",
        purpose: "并发幂等测试",
        idempotencyKey: concurrentIdempotencyKey,
      }),
    ]);
    expect(concurrentExportA.kind).toBe("created");
    expect(concurrentExportB.kind).toBe("created");
    if (concurrentExportA.kind !== "created" || concurrentExportB.kind !== "created") return;
    expect(concurrentExportB.exportRecord.id).toBe(concurrentExportA.exportRecord.id);

    await expect(
      prisma.reportExport.update({
        where: { id: firstExport.exportRecord.id },
        data: { purpose: "试图修改" },
      }),
    ).rejects.toThrow(/报告导出记录仅允许追加/);
    await expect(
      prisma.reportExport.delete({ where: { id: firstExport.exportRecord.id } }),
    ).rejects.toThrow(/报告导出记录仅允许追加/);

    const otherOrg = await prisma.organization.create({
      data: { name: "报告隔离组织", slug: `report-isolation-${Date.now()}` },
    });
    expect(await analyticsRepository.findReport({ orgId: otherOrg.id }, root.id)).toBeNull();
  });
});
