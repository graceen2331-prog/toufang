import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMetricMock = vi.fn();

vi.mock("./analytics.repository", () => ({
  analyticsRepository: {
    upsertMetric: upsertMetricMock,
    getCampaign: vi.fn(),
    listMetrics: vi.fn(),
    listInsights: vi.fn(),
    listReports: vi.fn(),
    findReport: vi.fn(),
    updateReport: vi.fn(),
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
});
