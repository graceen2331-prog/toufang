import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMetricMock = vi.fn();
const findReportMock = vi.fn();
const updateReportMock = vi.fn();

vi.mock("./analytics.repository", () => ({
  analyticsRepository: {
    upsertMetric: upsertMetricMock,
    getCampaign: vi.fn(),
    listMetrics: vi.fn(),
    listInsights: vi.fn(),
    listReports: vi.fn(),
    findReport: findReportMock,
    updateReport: updateReportMock,
    transitionReport: vi.fn(),
    createInsight: vi.fn(),
    createReport: vi.fn(),
    getAgentRunTrace: vi.fn(),
  },
}));

vi.mock("@/server/workflows/engine", () => ({
  startWorkflow: vi.fn(),
}));

vi.mock("@/server/modules/checkpoint/checkpoint.repository", () => ({
  checkpointRepository: {
    create: vi.fn(),
  },
}));

describe("analytics 指标计算", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("缺少收入/成本/点击时不编造 KPI", async () => {
    const { calculateKpis, sumMetricRows } = await import("./analytics.service");
    const totals = sumMetricRows([{ metrics: { impressions: 1000, views: 600, likes: 50 } }]);

    expect(calculateKpis(totals)).toMatchObject({
      ctr: 0,
      conversion_rate: null,
      roi: null,
      cpa_cents: null,
    });
  });

  it("upsert 指标时将空平台归一为 all，保证同一唯一键幂等", async () => {
    upsertMetricMock.mockResolvedValue({
      id: "metric-1",
      entityType: "campaign",
      entityId: "campaign-1",
      platform: "all",
      metricDate: new Date("2026-07-04T00:00:00.000Z"),
      metrics: { views: 100 },
      source: "manual",
      createdAt: new Date("2026-07-04T00:00:00.000Z"),
    });
    const { upsertMetric } = await import("./analytics.service");

    await upsertMetric(
      { orgId: "org-1", userId: "user-1" },
      {
        entity_type: "campaign",
        entity_id: "campaign-1",
        platform: null,
        metric_date: "2026-07-04",
        metrics: { views: 100 },
        source: "manual",
      },
    );

    expect(upsertMetricMock).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      expect.objectContaining({ platform: "all" }),
    );
  });

  it("高表现与需关注列表不会重复展示同一对象", async () => {
    const { rankPerformers } = await import("./analytics.service");
    const rows = [100, 80, 60, 40].map((views, index) => ({
      entityType: "content_asset",
      entityId: `asset-${index}`,
      label: `内容 ${index}`,
      metrics: { views },
    }));

    const result = rankPerformers(rows);
    const topIds = new Set(result.top.map((item) => item.entity_id));

    expect(result.top).toHaveLength(2);
    expect(result.low).toHaveLength(2);
    expect(result.low.every((item) => !topIds.has(item.entity_id))).toBe(true);
  });
});

describe("analytics 正式报告保护", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["in_review", "approved", "exported"])("%s 状态的报告不可修改", async (status) => {
    findReportMock.mockResolvedValue({ id: "report-1", status });
    const { updateReport } = await import("./analytics.service");

    await expect(
      updateReport({ orgId: "org-1", userId: "user-1" }, "report-1", { title: "篡改后的标题" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(updateReportMock).not.toHaveBeenCalled();
  });

  it("草稿报告仍可保存", async () => {
    const report = {
      id: "report-1",
      tenantId: "org-1",
      campaignId: null,
      title: "草稿报告",
      kind: "campaign_retro",
      status: "draft",
      content: {},
      approvedAt: null,
      approvedBy: null,
      aiGenerated: false,
      agentRunId: null,
      promptKey: null,
      promptVersion: null,
      model: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      createdBy: "user-1",
      updatedBy: null,
      deletedAt: null,
    };
    findReportMock.mockResolvedValue(report);
    updateReportMock.mockResolvedValue({ ...report, title: "更新后的草稿" });
    const { updateReport } = await import("./analytics.service");

    const updated = await updateReport({ orgId: "org-1", userId: "user-1" }, "report-1", {
      title: "更新后的草稿",
    });

    expect(updated.title).toBe("更新后的草稿");
    expect(updateReportMock).toHaveBeenCalledOnce();
  });
});
