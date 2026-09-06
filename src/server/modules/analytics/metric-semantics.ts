import type {
  AnalyticsDataQualityIssue,
  AnalyticsKpiDetail,
  AnalyticsKpiState,
  AnalyticsOverviewDto,
} from "@/shared/schemas/content-analytics";

export const METRIC_KEYS = [
  "impressions",
  "views",
  "likes",
  "comments",
  "shares",
  "clicks",
  "conversions",
  "revenue_cents",
  "cost_cents",
] as const;

type MetricKey = (typeof METRIC_KEYS)[number];
type Grain = "campaign" | "campaign_creator" | "content_asset";

export interface SemanticMetricRow {
  entityType: string;
  entityId: string;
  label: string;
  campaignId: string | null;
  campaignCurrency: string | null;
  platform: string | null;
  metricDate: Date;
  metrics: unknown;
  source: string;
  currency: string | null;
  attributionWindowDays: number | null;
  attributionModel: string | null;
  sourceObservedAt: Date | null;
  ingestedAt: Date;
}

interface FamilyDefinition {
  fields: MetricKey[];
  unit: AnalyticsKpiDetail["unit"];
}

const FAMILY_DEFINITIONS = {
  reach: { fields: ["impressions", "views"], unit: "count" },
  engagement: {
    fields: ["impressions", "likes", "comments", "shares"],
    unit: "percent",
  },
  traffic: { fields: ["impressions", "clicks"], unit: "percent" },
  conversion: { fields: ["clicks", "conversions"], unit: "percent" },
  finance: {
    fields: ["revenue_cents", "cost_cents", "conversions"],
    unit: "multiple",
  },
} as const satisfies Record<string, FamilyDefinition>;

type FamilyKey = keyof typeof FAMILY_DEFINITIONS;

interface SelectedFamily {
  state: AnalyticsKpiState;
  reason: string | null;
  rows: SemanticMetricRow[];
  grain: Grain | null;
  source: string | null;
  observedRows: number;
  totalRows: number;
}

interface FamilyAggregate extends SelectedFamily {
  totals: Record<string, number>;
}

function issue(
  code: string,
  message: string,
  severity: AnalyticsDataQualityIssue["severity"] = "warning",
): AnalyticsDataQualityIssue {
  return { code, message, severity };
}

function pushIssue(target: AnalyticsDataQualityIssue[], next: AnalyticsDataQualityIssue): void {
  if (!target.some((item) => item.code === next.code && item.message === next.message)) {
    target.push(next);
  }
}

export function asMetricMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) result[key] = raw;
  }
  return result;
}

function hasFields(row: SemanticMetricRow, fields: readonly MetricKey[]): boolean {
  const metrics = asMetricMap(row.metrics);
  return fields.every((field) => Object.hasOwn(metrics, field));
}

function selectFamily(
  rows: SemanticMetricRow[],
  definition: FamilyDefinition,
  issues: AnalyticsDataQualityIssue[],
): SelectedFamily {
  for (const grain of ["campaign", "campaign_creator", "content_asset"] as const) {
    const grainRows = rows.filter((row) => row.entityType === grain);
    if (grainRows.length === 0) continue;
    const validRows = grainRows.filter((row) => hasFields(row, definition.fields));
    if (validRows.length !== grainRows.length) continue;
    const sources = new Set(validRows.map((row) => row.source));
    if (sources.size !== 1) {
      pushIssue(issues, issue("MIXED_SOURCES", "同一指标口径存在多个来源，已停止合并。"));
      return {
        state: "ambiguous",
        reason: "mixed_sources",
        rows: [],
        grain,
        source: null,
        observedRows: validRows.length,
        totalRows: grainRows.length,
      };
    }
    if (rows.some((row) => row.entityType !== grain)) {
      pushIssue(
        issues,
        issue("MIXED_GRAIN_IGNORED", "同一日期存在多层指标，已只采用最高可用聚合层避免重复计算。", "info"),
      );
    }
    return {
      state: "complete",
      reason: null,
      rows: validRows,
      grain,
      source: [...sources][0] ?? null,
      observedRows: validRows.length,
      totalRows: grainRows.length,
    };
  }
  pushIssue(issues, issue("MISSING_METRIC_FIELDS", "部分指标族缺少完整字段，相关 KPI 未计算。"));
  return {
    state: rows.length > 0 ? "partial" : "missing",
    reason: rows.length > 0 ? "missing_metric_fields" : "no_rows",
    rows: [],
    grain: null,
    source: null,
    observedRows: 0,
    totalRows: rows.length,
  };
}

function aggregateFamily(
  groups: SemanticMetricRow[][],
  family: FamilyKey,
  issues: AnalyticsDataQualityIssue[],
): FamilyAggregate {
  const definition = FAMILY_DEFINITIONS[family];
  const selected = groups.map((rows) => selectFamily(rows, definition, issues));
  const complete = selected.filter((item) => item.state === "complete");
  const states = new Set(selected.map((item) => item.state));
  const grains = new Set(complete.map((item) => item.grain).filter(Boolean));
  const sources = new Set(complete.map((item) => item.source).filter(Boolean));
  let state: AnalyticsKpiState = complete.length === groups.length ? "complete" : "partial";
  let reason: string | null = state === "complete" ? null : "partial_coverage";
  if (states.has("ambiguous") || grains.size > 1 || sources.size > 1) {
    state = "ambiguous";
    reason = grains.size > 1 ? "mixed_grain" : "mixed_sources";
    pushIssue(
      issues,
      issue(
        grains.size > 1 ? "MIXED_GRAIN_IGNORED" : "MIXED_SOURCES",
        grains.size > 1
          ? "筛选范围内指标聚合层不一致，相关 KPI 未合并。"
          : "筛选范围内指标来源不一致，相关 KPI 未合并。",
      ),
    );
  } else if (complete.length === 0) {
    state = groups.length > 0 ? "missing" : "missing";
    reason = "no_complete_cohort";
  } else if (complete.length < groups.length) {
    pushIssue(issues, issue("PARTIAL_COVERAGE", "筛选范围内只有部分日期具备完整指标，相关 KPI 未展示。"));
  }

  const rows = complete.flatMap((item) => item.rows);
  const totals: Record<string, number> = {};
  if (state === "complete") {
    for (const field of definition.fields) {
      totals[field] = rows.reduce((sum, row) => sum + (asMetricMap(row.metrics)[field] ?? 0), 0);
    }
  }
  return {
    state,
    reason,
    rows,
    grain: grains.size === 1 ? ([...grains][0] as Grain) : null,
    source: sources.size === 1 ? ([...sources][0] as string) : null,
    observedRows: complete.reduce((sum, item) => sum + item.observedRows, 0),
    totalRows: selected.reduce((sum, item) => sum + item.totalRows, 0),
    totals,
  };
}

function detail(
  aggregate: FamilyAggregate,
  value: number | null,
  unit: AnalyticsKpiDetail["unit"],
  reason = aggregate.reason,
): AnalyticsKpiDetail {
  return {
    value,
    state: aggregate.state,
    reason,
    unit,
    grain: aggregate.grain,
    source: aggregate.source,
    observed_rows: aggregate.observedRows,
    total_rows: aggregate.totalRows,
  };
}

function derivedRate(
  aggregate: FamilyAggregate,
  numerator: number,
  denominator: number,
): { value: number | null; reason: string | null } {
  if (aggregate.state !== "complete") return { value: null, reason: aggregate.reason };
  if (denominator <= 0) return { value: null, reason: "zero_denominator" };
  return { value: numerator / denominator, reason: null };
}

export function sumMetricRows(rows: Array<{ metrics: unknown }>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const metrics = asMetricMap(row.metrics);
    for (const key of METRIC_KEYS) {
      if (Object.hasOwn(metrics, key)) totals[key] = (totals[key] ?? 0) + metrics[key]!;
    }
  }
  return totals;
}

export function calculateKpis(totals: Record<string, number>): AnalyticsOverviewDto["kpis"] {
  const engagements = ["likes", "comments", "shares"].every((key) => Object.hasOwn(totals, key))
    ? (totals.likes ?? 0) + (totals.comments ?? 0) + (totals.shares ?? 0)
    : null;
  const impressions = totals.impressions;
  const clicks = totals.clicks;
  const conversions = totals.conversions;
  const revenue = totals.revenue_cents;
  const cost = totals.cost_cents;
  return {
    engagement_rate: engagements !== null && impressions !== undefined && impressions > 0
      ? engagements / impressions
      : null,
    ctr: clicks !== undefined && impressions !== undefined && impressions > 0
      ? clicks / impressions
      : null,
    conversion_rate: conversions !== undefined && clicks !== undefined && clicks > 0
      ? conversions / clicks
      : null,
    roas: revenue !== undefined && cost !== undefined && cost > 0 ? revenue / cost : null,
    roi: null,
    cpa_cents: cost !== undefined && conversions !== undefined && conversions > 0
      ? Math.round(cost / conversions)
      : null,
  };
}

export function rankPerformerGroups(
  rows: SemanticMetricRow[],
): AnalyticsOverviewDto["ranking_groups"] {
  const byEntity = new Map<string, SemanticMetricRow[]>();
  for (const row of rows) {
    if (row.entityType !== "campaign_creator" && row.entityType !== "content_asset") continue;
    const key = `${row.entityType}:${row.platform ?? "all"}:${row.entityId}`;
    const bucket = byEntity.get(key) ?? [];
    bucket.push(row);
    byEntity.set(key, bucket);
  }
  const comparable = [...byEntity.values()].flatMap((entityRows) => {
    const sources = new Set(entityRows.map((row) => row.source));
    if (sources.size !== 1 || !entityRows.every((row) => hasFields(row, FAMILY_DEFINITIONS.engagement.fields))) {
      return [];
    }
    const metrics = sumMetricRows(entityRows);
    const impressions = metrics.impressions ?? 0;
    if (impressions < 100) return [];
    const engagementRate = ((metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0)) / impressions;
    const first = entityRows[0]!;
    return [{
      entity_id: first.entityId,
      entity_type: first.entityType as "campaign_creator" | "content_asset",
      label: first.label,
      platform: first.platform ?? "all",
      ranking_metric: "engagement_rate" as const,
      metric_value: engagementRate,
      sample_size: impressions,
      score: engagementRate,
      metrics,
    }];
  });

  const groupKeys = [...new Set(comparable.map((item) => `${item.entity_type}:${item.platform}`))];
  return groupKeys.map((key) => {
    const items = comparable
      .filter((item) => `${item.entity_type}:${item.platform}` === key)
      .sort((a, b) => b.metric_value - a.metric_value || b.sample_size - a.sample_size);
    const topCount = Math.min(3, Math.ceil(items.length / 2));
    const top = items.slice(0, topCount);
    const topIds = new Set(top.map((item) => item.entity_id));
    const low = items.slice(topCount).slice(-3).reverse().filter((item) => !topIds.has(item.entity_id));
    const [entityType, platform] = key.split(":") as ["campaign_creator" | "content_asset", string];
    const candidateEntityCount = [...byEntity.entries()].filter(([entityKey]) =>
      entityKey.startsWith(`${entityType}:${platform}:`),
    ).length;
    return {
      entity_type: entityType,
      platform,
      ranking_metric: "engagement_rate" as const,
      minimum_impressions: 100,
      excluded_count: candidateEntityCount - items.length,
      top,
      low,
    };
  });
}

export function rankPerformers(
  rows: SemanticMetricRow[],
): {
  top: AnalyticsOverviewDto["top_performers"];
  low: AnalyticsOverviewDto["low_performers"];
  groups: AnalyticsOverviewDto["ranking_groups"];
} {
  const rankingGroups = rankPerformerGroups(rows);
  return {
    top: rankingGroups.flatMap((group) => group.top),
    low: rankingGroups.flatMap((group) => group.low),
    groups: rankingGroups,
  };
}

export function aggregateMetricSemantics(rows: SemanticMetricRow[]): {
  totals: Record<string, number>;
  kpis: AnalyticsOverviewDto["kpis"];
  kpiDetails: AnalyticsOverviewDto["kpi_details"];
  financialContext: AnalyticsOverviewDto["financial_context"];
  freshness: AnalyticsOverviewDto["freshness"];
  issues: AnalyticsDataQualityIssue[];
} {
  const issues: AnalyticsDataQualityIssue[] = [];
  const assignedRows = rows.filter((row) => row.campaignId);
  if (assignedRows.length !== rows.length) {
    pushIssue(issues, issue("UNASSIGNED_ROWS", "存在无法映射到 Campaign 的指标行，已从总览排除。"));
  }
  if (assignedRows.length === 0) {
    pushIssue(issues, issue("NO_DATA", "当前筛选范围内没有可归属的指标数据。", "info"));
  }
  const byCampaignDate = new Map<string, SemanticMetricRow[]>();
  for (const row of assignedRows) {
    const key = `${row.campaignId}:${row.metricDate.toISOString().slice(0, 10)}`;
    const bucket = byCampaignDate.get(key) ?? [];
    bucket.push(row);
    byCampaignDate.set(key, bucket);
  }
  const groups = [...byCampaignDate.values()];
  const reach = aggregateFamily(groups, "reach", issues);
  const engagement = aggregateFamily(groups, "engagement", issues);
  const traffic = aggregateFamily(groups, "traffic", issues);
  const conversion = aggregateFamily(groups, "conversion", issues);
  const finance = aggregateFamily(groups, "finance", issues);

  const totals: Record<string, number> = {
    ...reach.totals,
    ...engagement.totals,
    ...traffic.totals,
    ...conversion.totals,
    ...finance.totals,
  };
  const engagementRate = derivedRate(
    engagement,
    (engagement.totals.likes ?? 0) + (engagement.totals.comments ?? 0) + (engagement.totals.shares ?? 0),
    engagement.totals.impressions ?? 0,
  );
  const ctr = derivedRate(traffic, traffic.totals.clicks ?? 0, traffic.totals.impressions ?? 0);
  const conversionRate = derivedRate(
    conversion,
    conversion.totals.conversions ?? 0,
    conversion.totals.clicks ?? 0,
  );

  const currencies = new Set(finance.rows.map((row) => row.currency ?? row.campaignCurrency).filter(Boolean));
  const attributionWindows = new Set(finance.rows.map((row) => row.attributionWindowDays).filter((value) => value !== null));
  const attributionModels = new Set(finance.rows.map((row) => row.attributionModel).filter(Boolean));
  if (finance.rows.some((row) => !row.currency && row.campaignCurrency)) {
    pushIssue(issues, issue("CURRENCY_INFERRED", "部分历史财务指标的币种由 Campaign 设置推断。", "info"));
  }
  if (currencies.size > 1) pushIssue(issues, issue("MULTI_CURRENCY", "筛选范围包含多种币种，财务指标未合并。"));
  if (finance.rows.some((row) => row.attributionWindowDays === null || !row.attributionModel)) {
    pushIssue(issues, issue("ATTRIBUTION_UNDECLARED", "财务指标未完整声明归因窗口与模型，ROAS 不展示。"));
  }
  if (attributionWindows.size > 1 || attributionModels.size > 1) {
    pushIssue(issues, issue("MIXED_ATTRIBUTION", "筛选范围内归因口径不一致，ROAS 不展示。"));
  }
  const financeMetadataComplete =
    finance.state === "complete" &&
    currencies.size === 1 &&
    attributionWindows.size === 1 &&
    attributionModels.size === 1 &&
    finance.rows.every((row) => row.attributionWindowDays !== null && Boolean(row.attributionModel));
  const cost = finance.totals.cost_cents ?? 0;
  const revenue = finance.totals.revenue_cents ?? 0;
  const roas = financeMetadataComplete && cost > 0 ? revenue / cost : null;
  const roasReason = finance.state !== "complete"
    ? finance.reason
    : !financeMetadataComplete
      ? "financial_context_incomplete"
      : cost <= 0
        ? "zero_denominator"
        : null;
  const cpa = financeMetadataComplete && (finance.totals.conversions ?? 0) > 0
    ? Math.round(cost / finance.totals.conversions!)
    : null;
  if (currencies.size !== 1) {
    delete totals.revenue_cents;
    delete totals.cost_cents;
  }

  const roasDetail = detail(finance, roas, "multiple", roasReason);
  if (finance.state === "complete" && !financeMetadataComplete) {
    roasDetail.state = currencies.size > 1 || attributionWindows.size > 1 || attributionModels.size > 1
      ? "ambiguous"
      : "partial";
  }
  const cpaDetail = detail(
    finance,
    cpa,
    "currency_minor",
    cpa === null
      ? (financeMetadataComplete ? "zero_denominator" : "financial_context_incomplete")
      : null,
  );
  if (finance.state === "complete" && !financeMetadataComplete) cpaDetail.state = roasDetail.state;

  const latestObserved = rows
    .map((row) => row.sourceObservedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const latestIngested = rows
    .map((row) => row.ingestedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    totals,
    kpis: {
      engagement_rate: engagementRate.value,
      ctr: ctr.value,
      conversion_rate: conversionRate.value,
      roas,
      roi: null,
      cpa_cents: cpa,
    },
    kpiDetails: {
      impressions: detail(reach, reach.state === "complete" ? (reach.totals.impressions ?? 0) : null, "count"),
      engagement_rate: detail(engagement, engagementRate.value, "percent", engagementRate.reason),
      ctr: detail(traffic, ctr.value, "percent", ctr.reason),
      conversion_rate: detail(conversion, conversionRate.value, "percent", conversionRate.reason),
      roas: roasDetail,
      cpa_cents: cpaDetail,
    },
    financialContext: {
      currency: currencies.size === 1 ? ([...currencies][0] as string) : null,
      attribution_window_days: attributionWindows.size === 1 ? ([...attributionWindows][0] as number) : null,
      attribution_model: attributionModels.size === 1 ? ([...attributionModels][0] as string) : null,
      revenue_cents: finance.state === "complete" ? (finance.totals.revenue_cents ?? 0) : null,
      cost_cents: finance.state === "complete" ? (finance.totals.cost_cents ?? 0) : null,
    },
    freshness: {
      latest_source_observed_at: latestObserved?.toISOString() ?? null,
      latest_ingested_at: latestIngested?.toISOString() ?? null,
    },
    issues,
  };
}
