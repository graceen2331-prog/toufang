import { describe, expect, it } from "vitest";
import {
  aggregateMetricSemantics,
  rankPerformerGroups,
  type SemanticMetricRow,
} from "./metric-semantics";

function row(overrides: Partial<SemanticMetricRow> = {}): SemanticMetricRow {
  return {
    entityType: "campaign",
    entityId: "campaign-1",
    label: "测试 Campaign",
    campaignId: "campaign-1",
    campaignCurrency: "CNY",
    platform: "all",
    metricDate: new Date("2026-08-01T00:00:00.000Z"),
    metrics: {
      impressions: 1000,
      views: 600,
      likes: 80,
      comments: 10,
      shares: 10,
      clicks: 100,
      conversions: 10,
      revenue_cents: 200_000,
      cost_cents: 100_000,
    },
    source: "integration",
    currency: "CNY",
    attributionWindowDays: 7,
    attributionModel: "last_click",
    sourceObservedAt: new Date("2026-08-02T00:00:00.000Z"),
    ingestedAt: new Date("2026-08-02T00:05:00.000Z"),
    ...overrides,
  };
}

describe("指标语义聚合", () => {
  it("Campaign 汇总与内容明细并存时只采用 Campaign 粒度", () => {
    const result = aggregateMetricSemantics([
      row(),
      row({
        entityType: "content_asset",
        entityId: "asset-1",
        platform: "douyin",
        metrics: {
          impressions: 500,
          views: 300,
          likes: 30,
          comments: 5,
          shares: 5,
          clicks: 50,
          conversions: 5,
          revenue_cents: 100_000,
          cost_cents: 50_000,
        },
      }),
    ]);

    expect(result.totals.impressions).toBe(1000);
    expect(result.kpis.roas).toBe(2);
    expect(result.issues.map((item) => item.code)).toContain("MIXED_GRAIN_IGNORED");
  });

  it("缺失字段与明确为 0 使用不同语义", () => {
    const missing = aggregateMetricSemantics([
      row({ metrics: { impressions: 1000, views: 500, likes: 0, comments: 0, shares: 0 } }),
    ]);
    const observedZero = aggregateMetricSemantics([
      row({
        metrics: {
          impressions: 1000,
          views: 500,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          conversions: 0,
          revenue_cents: 0,
          cost_cents: 100,
        },
      }),
    ]);

    expect(missing.kpis.ctr).toBeNull();
    expect(observedZero.kpis.engagement_rate).toBe(0);
    expect(observedZero.kpis.roas).toBe(0);
  });

  it("未声明归因或多币种时不合并 ROAS", () => {
    const missingAttribution = aggregateMetricSemantics([
      row({ attributionWindowDays: null, attributionModel: null }),
    ]);
    expect(missingAttribution.kpis.roas).toBeNull();
    expect(missingAttribution.issues.map((item) => item.code)).toContain("ATTRIBUTION_UNDECLARED");

    const multiCurrency = aggregateMetricSemantics([
      row(),
      row({
        entityId: "campaign-2",
        campaignId: "campaign-2",
        campaignCurrency: "USD",
        currency: "USD",
      }),
    ]);
    expect(multiCurrency.kpis.roas).toBeNull();
    expect(multiCurrency.issues.map((item) => item.code)).toContain("MULTI_CURRENCY");
  });
});

describe("可解释排名", () => {
  it("按实体类型和平台分组，并排除曝光不足样本", () => {
    const groups = rankPerformerGroups([
      row({
        entityType: "content_asset",
        entityId: "asset-high",
        platform: "douyin",
        metrics: { impressions: 1000, likes: 100, comments: 10, shares: 10 },
      }),
      row({
        entityType: "content_asset",
        entityId: "asset-low",
        platform: "douyin",
        metrics: { impressions: 1000, likes: 20, comments: 5, shares: 5 },
      }),
      row({
        entityType: "content_asset",
        entityId: "asset-small",
        platform: "xiaohongshu",
        metrics: { impressions: 99, likes: 50, comments: 10, shares: 10 },
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ entity_type: "content_asset", platform: "douyin" });
    expect(groups[0]!.top[0]!.entity_id).toBe("asset-high");
    expect(groups[0]!.low[0]!.entity_id).toBe("asset-low");
  });
});
