import { z } from "zod";

export const ContentAssetCreateSchema = z.object({
  campaign_creator_id: z.string().min(1, "请选择 Campaign 达人"),
  brief_id: z.string().nullish(),
  title: z.string().max(200).nullish(),
  content_type: z.enum(["video", "image", "article", "live"]).nullish(),
  platform: z.string().max(40).nullish(),
  caption: z.string().max(5000).nullish(),
  transcript: z.string().max(20000).nullish(),
  url: z.string().url().nullish(),
  planned_publish_at: z.string().nullish(),
});
export type ContentAssetCreateInput = z.infer<typeof ContentAssetCreateSchema>;

export const ContentAssetStatusSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

export const ContentReviewTriggerSchema = z.object({
  instruction: z.string().max(500).nullish(),
});

export const MetricUpsertSchema = z.object({
  entity_type: z.enum(["campaign", "campaign_creator", "content_asset"]),
  entity_id: z.string().min(1),
  platform: z.string().max(40).nullish(),
  metric_date: z.string().min(1),
  metrics: z.object({
    impressions: z.number().int().nonnegative().optional(),
    views: z.number().int().nonnegative().optional(),
    likes: z.number().int().nonnegative().optional(),
    comments: z.number().int().nonnegative().optional(),
    shares: z.number().int().nonnegative().optional(),
    clicks: z.number().int().nonnegative().optional(),
    conversions: z.number().int().nonnegative().optional(),
    revenue_cents: z.number().int().nonnegative().optional(),
    cost_cents: z.number().int().nonnegative().optional(),
  }),
  source: z.enum(["manual", "import", "integration"]).default("manual"),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).nullish(),
  attribution_window_days: z.number().int().min(1).max(365).nullish(),
  attribution_model: z.string().trim().min(1).max(40).nullish(),
  source_record_id: z.string().trim().min(1).max(200).nullish(),
  source_observed_at: z.string().datetime({ offset: true }).nullish(),
  metric_schema_version: z.number().int().min(1).default(2),
});
export type MetricUpsertInput = z.infer<typeof MetricUpsertSchema>;

export const GenerateAnalyticsSchema = z.object({
  campaign_id: z.string().min(1, "请选择 Campaign"),
  date_from: z.string().nullish(),
  date_to: z.string().nullish(),
});

export const InsightStatusSchema = z.object({
  status: z.enum(["open", "acknowledged", "dismissed"]),
});

export const ReportUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  expected_lock_version: z.number().int().min(0),
});

export const ReportStatusSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
  expected_lock_version: z.number().int().min(0).optional(),
});

export const ReportDeriveSchema = z.object({
  reason: z.string().trim().min(1, "请说明修订原因").max(500),
});

export const ReportExportSchema = z.object({
  format: z.literal("json_snapshot").default("json_snapshot"),
  recipient: z.string().trim().min(1).max(200).default("内部存档"),
  purpose: z.string().trim().max(500).nullish(),
  idempotency_key: z.string().min(1).max(100),
});

export interface ContentReviewFindingDto {
  id?: string;
  type: string;
  severity: "low" | "medium" | "high";
  quote: string | null;
  issue: string;
  suggestion: string;
  origin?: "deterministic" | "ai";
  source?: "brand" | "brief" | "platform" | "system" | "ai";
  rule_id?: string;
  rule_version?: string;
  blocking?: boolean;
  field?: "caption" | "transcript" | "combined";
}

export interface ContentReviewDto {
  id: string;
  content_asset_id: string;
  status: string;
  decision: string | null;
  risk_level: string | null;
  findings: ContentReviewFindingDto[];
  feedback: string | null;
  reviewer_id: string | null;
  input_hash: string | null;
  rule_set_version: string | null;
  final_decision: string | null;
  checkpoint_id: string | null;
  normalization_notes: string[];
  override_metadata: Record<string, unknown>;
  ai_generated: boolean;
  model: string | null;
  prompt_key: string | null;
  prompt_version: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ContentAssetDto {
  id: string;
  campaign_creator_id: string;
  campaign_id: string;
  campaign_name: string;
  creator_name: string;
  brief_id: string | null;
  brief_title: string | null;
  title: string | null;
  status: string;
  content_type: string | null;
  platform: string | null;
  caption: string | null;
  transcript: string | null;
  url: string | null;
  planned_publish_at: string | null;
  published_at: string | null;
  published_url: string | null;
  approval_evidence_present: boolean;
  content_approved_at: string | null;
  latest_review: ContentReviewDto | null;
  pending_workflow_run_id: string | null;
  pending_checkpoint_id: string | null;
  pending_findings: ContentReviewFindingDto[];
  pending_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetricDto {
  id: string;
  entity_type: string;
  entity_id: string;
  platform: string | null;
  metric_date: string;
  metrics: Record<string, number>;
  source: string;
  currency: string | null;
  attribution_window_days: number | null;
  attribution_model: string | null;
  source_record_id: string | null;
  source_observed_at: string | null;
  ingested_at: string;
  metric_schema_version: number;
  created_at: string;
}

export type AnalyticsKpiState = "complete" | "partial" | "missing" | "invalid" | "ambiguous";

export interface AnalyticsKpiDetail {
  value: number | null;
  state: AnalyticsKpiState;
  reason: string | null;
  unit: "count" | "percent" | "multiple" | "currency_minor";
  grain: string | null;
  source: string | null;
  observed_rows: number;
  total_rows: number;
}

export interface AnalyticsDataQualityIssue {
  code: string;
  message: string;
  severity: "info" | "warning";
}

export interface AnalyticsOverviewDto {
  campaign_id: string | null;
  date_from: string | null;
  date_to: string | null;
  scope: {
    requested_date_from: string | null;
    requested_date_to: string | null;
    actual_date_from: string | null;
    actual_date_to: string | null;
    label: string;
  };
  totals: Record<string, number>;
  kpis: {
    engagement_rate: number | null;
    ctr: number | null;
    conversion_rate: number | null;
    roas: number | null;
    roi: null;
    cpa_cents: number | null;
  };
  kpi_details: {
    impressions: AnalyticsKpiDetail;
    engagement_rate: AnalyticsKpiDetail;
    ctr: AnalyticsKpiDetail;
    conversion_rate: AnalyticsKpiDetail;
    roas: AnalyticsKpiDetail;
    cpa_cents: AnalyticsKpiDetail;
  };
  financial_context: {
    currency: string | null;
    attribution_window_days: number | null;
    attribution_model: string | null;
    revenue_cents: number | null;
    cost_cents: number | null;
  };
  freshness: {
    latest_source_observed_at: string | null;
    latest_ingested_at: string | null;
  };
  series: Array<{
    date: string;
    views: number | null;
    engagements: number | null;
    conversions: number | null;
    revenue_cents: number | null;
  }>;
  top_performers: Array<{
    entity_id: string;
    entity_type: string;
    label: string;
    score: number;
    platform: string;
    ranking_metric: "engagement_rate";
    metric_value: number;
    sample_size: number;
    metrics: Record<string, number>;
  }>;
  low_performers: Array<{
    entity_id: string;
    entity_type: string;
    label: string;
    score: number;
    platform: string;
    ranking_metric: "engagement_rate";
    metric_value: number;
    sample_size: number;
    metrics: Record<string, number>;
  }>;
  ranking_groups: Array<{
    entity_type: "campaign_creator" | "content_asset";
    platform: string;
    ranking_metric: "engagement_rate";
    minimum_impressions: number;
    excluded_count: number;
    top: AnalyticsOverviewDto["top_performers"];
    low: AnalyticsOverviewDto["low_performers"];
  }>;
  data_quality_issues: AnalyticsDataQualityIssue[];
  data_quality_notes: string[];
  insights: InsightDto[];
}

export interface InsightDto {
  id: string;
  campaign_id: string | null;
  kind: string;
  title: string;
  content: string;
  severity: string;
  data: Record<string, unknown>;
  status: string;
  ai_generated: boolean;
  model: string | null;
  prompt_key: string | null;
  prompt_version: string | null;
  created_at: string;
}

export interface ReportDto {
  id: string;
  series_id: string;
  version: number;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  lock_version: number;
  campaign_id: string | null;
  title: string;
  kind: string;
  status: string;
  content: Record<string, unknown>;
  approved_at: string | null;
  approved_by: string | null;
  approved_snapshot_hash: string | null;
  hash_algorithm: string | null;
  derivation_reason: string | null;
  exports: ReportExportDto[];
  ai_generated: boolean;
  model: string | null;
  prompt_key: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportExportDto {
  id: string;
  report_id: string;
  report_version: number;
  format: "json_snapshot";
  recipient: string;
  purpose: string | null;
  snapshot: Record<string, unknown>;
  snapshot_hash: string;
  hash_algorithm: string;
  created_by: string | null;
  created_at: string;
}

export interface ReportExportResultDto {
  report: ReportDto;
  export: ReportExportDto;
}
