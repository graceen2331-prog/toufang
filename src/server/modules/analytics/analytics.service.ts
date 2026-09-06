import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { startWorkflow } from "@/server/workflows/engine";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { REPORT_STATUS, assertTransition } from "@/shared/constants/status";
import type { StartWorkflowResponseDto } from "@/shared/schemas/workflow";
import type { AnalyticsOutput } from "@/server/ai/prompts/analytics";
import type { ReportOutput } from "@/server/ai/prompts/report";
import type {
  Insight,
  PerformanceMetric,
  Prisma,
  ReportExport,
  WorkflowRun,
} from "@/generated/prisma/client";
import type {
  AnalyticsOverviewDto,
  InsightDto,
  MetricDto,
  MetricUpsertInput,
  ReportDto,
  ReportExportDto,
  ReportExportResultDto,
} from "@/shared/schemas/content-analytics";
import {
  analyticsRepository,
  type AnalyticsQueryParams,
  type InsightListParams,
  type MetricWithLabel,
  type ReportListParams,
  type ReportWithRelations,
} from "./analytics.repository";
import {
  aggregateMetricSemantics,
  asMetricMap,
  rankPerformers,
} from "./metric-semantics";

export { calculateKpis, rankPerformers, sumMetricRows } from "./metric-semantics";

function metricToDto(metric: PerformanceMetric): MetricDto {
  return {
    id: metric.id,
    entity_type: metric.entityType,
    entity_id: metric.entityId,
    platform: metric.platform,
    metric_date: metric.metricDate.toISOString().slice(0, 10),
    metrics: asMetricMap(metric.metrics),
    source: metric.source,
    currency: metric.currency,
    attribution_window_days: metric.attributionWindowDays,
    attribution_model: metric.attributionModel,
    source_record_id: metric.sourceRecordId,
    source_observed_at: metric.sourceObservedAt?.toISOString() ?? null,
    ingested_at: metric.ingestedAt.toISOString(),
    metric_schema_version: metric.metricSchemaVersion,
    created_at: metric.createdAt.toISOString(),
  };
}

function insightToDto(insight: Insight): InsightDto {
  return {
    id: insight.id,
    campaign_id: insight.campaignId,
    kind: insight.kind,
    title: insight.title,
    content: insight.content,
    severity: insight.severity,
    data: (insight.data as Record<string, unknown>) ?? {},
    status: insight.status,
    ai_generated: insight.aiGenerated,
    model: insight.model,
    prompt_key: insight.promptKey,
    prompt_version: insight.promptVersion,
    created_at: insight.createdAt.toISOString(),
  };
}

function reportExportToDto(record: ReportExport): ReportExportDto {
  return {
    id: record.id,
    report_id: record.reportId,
    report_version: record.reportVersion,
    format: "json_snapshot",
    recipient: record.recipient,
    purpose: record.purpose,
    snapshot: record.snapshot as Record<string, unknown>,
    snapshot_hash: record.snapshotHash,
    hash_algorithm: record.hashAlgorithm,
    created_by: record.createdBy,
    created_at: record.createdAt.toISOString(),
  };
}

function reportToDto(report: ReportWithRelations): ReportDto {
  return {
    id: report.id,
    series_id: report.seriesId,
    version: report.version,
    supersedes_id: report.supersedesId,
    superseded_by_id: report.supersededBy?.id ?? null,
    lock_version: report.lockVersion,
    campaign_id: report.campaignId,
    title: report.title,
    kind: report.kind,
    status: report.status,
    content: (report.content as Record<string, unknown>) ?? {},
    approved_at: report.approvedAt?.toISOString() ?? null,
    approved_by: report.approvedBy,
    approved_snapshot_hash: report.approvedSnapshotHash,
    hash_algorithm: report.hashAlgorithm,
    derivation_reason: report.derivationReason,
    exports: report.exports.map(reportExportToDto),
    ai_generated: report.aiGenerated,
    model: report.model,
    prompt_key: report.promptKey,
    prompt_version: report.promptVersion,
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function workflowResponse(run: WorkflowRun): StartWorkflowResponseDto {
  return {
    workflow_run_id: run.id,
    poll_url: `/api/v1/workflow-runs/${run.id}`,
    events_url: `/api/v1/workflow-runs/${run.id}/events`,
  };
}

function buildSeries(rows: MetricWithLabel[]): AnalyticsOverviewDto["series"] {
  const byDate = new Map<string, MetricWithLabel[]>();
  for (const row of rows) {
    const key = row.metricDate.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? [];
    bucket.push(row);
    byDate.set(key, bucket);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateRows]) => {
      const semantic = aggregateMetricSemantics(dateRows);
      return {
        date,
        views: semantic.totals.views ?? null,
        engagements:
          semantic.totals.likes === undefined ||
          semantic.totals.comments === undefined ||
          semantic.totals.shares === undefined
            ? null
            : semantic.totals.likes + semantic.totals.comments + semantic.totals.shares,
        conversions: semantic.totals.conversions ?? null,
        revenue_cents: semantic.totals.revenue_cents ?? null,
      };
    });
}

export async function upsertMetric(ctx: TenantCtx, input: MetricUpsertInput): Promise<MetricDto> {
  const metric = await analyticsRepository.upsertMetric(ctx, {
    entityType: input.entity_type,
    entityId: input.entity_id,
    platform: input.platform ?? "all",
    metricDate: parseDate(input.metric_date)!,
    metrics: input.metrics,
    source: input.source,
    currency: input.currency ?? null,
    attributionWindowDays: input.attribution_window_days ?? null,
    attributionModel: input.attribution_model ?? null,
    sourceRecordId: input.source_record_id ?? null,
    sourceObservedAt: input.source_observed_at ? new Date(input.source_observed_at) : null,
    metricSchemaVersion: input.metric_schema_version,
  });
  if (!metric) throw new ApiError("RESOURCE_NOT_FOUND", "指标关联的业务对象不存在");
  return metricToDto(metric);
}

export async function getAnalyticsOverview(
  ctx: TenantCtx,
  params: { campaignId?: string | null; dateFrom?: string | null; dateTo?: string | null },
): Promise<AnalyticsOverviewDto> {
  const query: AnalyticsQueryParams = {
    campaignId: params.campaignId ?? null,
    dateFrom: parseDate(params.dateFrom),
    dateTo: parseDate(params.dateTo),
  };
  const [rows, insightPage, campaign] = await Promise.all([
    analyticsRepository.listMetrics(ctx, query),
    analyticsRepository.listInsights(ctx, {
      limit: 20,
      cursor: null,
      order: "desc",
      campaignId: query.campaignId,
      status: "open",
      globalOnly: !query.campaignId,
    }),
    query.campaignId ? analyticsRepository.getCampaign(ctx, query.campaignId) : Promise.resolve(null),
  ]);
  if (query.campaignId && !campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  const semantic = aggregateMetricSemantics(rows);
  const ranked = rankPerformers(rows);
  const dates = rows.map((row) => row.metricDate.toISOString().slice(0, 10)).sort();
  return {
    campaign_id: query.campaignId,
    date_from: params.dateFrom ?? null,
    date_to: params.dateTo ?? null,
    scope: {
      requested_date_from: params.dateFrom ?? null,
      requested_date_to: params.dateTo ?? null,
      actual_date_from: dates[0] ?? null,
      actual_date_to: dates.at(-1) ?? null,
      label: campaign ? `Campaign：${campaign.name}` : "全部 Campaign",
    },
    totals: semantic.totals,
    kpis: semantic.kpis,
    kpi_details: semantic.kpiDetails,
    financial_context: semantic.financialContext,
    freshness: semantic.freshness,
    series: buildSeries(rows),
    top_performers: ranked.top,
    low_performers: ranked.low,
    ranking_groups: ranked.groups,
    data_quality_issues: semantic.issues,
    data_quality_notes: semantic.issues.map((item) => item.message),
    insights: insightPage.slice(0, 8).map(insightToDto),
  };
}

export async function startAnalyticsWorkflow(
  ctx: TenantCtx,
  input: { campaign_id: string; date_from?: string | null; date_to?: string | null },
): Promise<StartWorkflowResponseDto> {
  const campaign = await analyticsRepository.getCampaign(ctx, input.campaign_id);
  if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  const run = await startWorkflow(ctx, {
    key: "analytics",
    subjectType: "campaign",
    subjectId: input.campaign_id,
    input: { date_from: input.date_from ?? null, date_to: input.date_to ?? null },
  });
  return workflowResponse(run);
}

export async function listInsights(
  ctx: TenantCtx,
  params: InsightListParams,
): Promise<{ items: InsightDto[]; pagination: Pagination }> {
  const rows = await analyticsRepository.listInsights(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(insightToDto), pagination };
}

export async function updateInsightStatus(
  ctx: TenantCtx,
  id: string,
  status: string,
): Promise<InsightDto> {
  const insight = await analyticsRepository.updateInsightStatus(ctx, id, status);
  if (!insight) throw new ApiError("RESOURCE_NOT_FOUND", "洞察不存在");
  return insightToDto(insight);
}

export async function listReports(
  ctx: TenantCtx,
  params: ReportListParams,
): Promise<{ items: ReportDto[]; pagination: Pagination }> {
  const rows = await analyticsRepository.listReports(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(reportToDto), pagination };
}

export async function getReport(ctx: TenantCtx, id: string): Promise<ReportDto> {
  const report = await analyticsRepository.findReport(ctx, id);
  if (!report) throw new ApiError("RESOURCE_NOT_FOUND", "报告不存在");
  return reportToDto(report);
}

export async function updateReport(
  ctx: TenantCtx,
  id: string,
  input: {
    title?: string;
    content?: Record<string, unknown>;
    expected_lock_version: number;
  },
): Promise<ReportDto> {
  const current = await analyticsRepository.findReport(ctx, id);
  if (!current) throw new ApiError("RESOURCE_NOT_FOUND", "报告不存在");
  if (current.status !== "draft") {
    throw new ApiError(
      "CONFLICT",
      current.status === "in_review"
        ? "报告已提交审批，审批退回草稿后才能继续编辑"
        : "正式报告已冻结，不可直接修改；请重新生成报告并完成审批",
    );
  }
  const report = await analyticsRepository.updateDraftReport(ctx, id, input.expected_lock_version, {
    ...(input.title ? { title: input.title } : {}),
    ...(input.content ? { content: input.content as Prisma.InputJsonValue } : {}),
  });
  if (!report) {
    throw new ApiError("CONFLICT", "报告已被他人修改或已进入审批，请刷新后重试");
  }
  return reportToDto(report);
}

export async function transitionReportStatus(
  ctx: TenantCtx,
  id: string,
  to: string,
  reason?: string | null,
  expectedLockVersion?: number,
): Promise<ReportDto> {
  const report = await analyticsRepository.findReport(ctx, id);
  if (!report) throw new ApiError("RESOURCE_NOT_FOUND", "报告不存在");
  assertTransition(REPORT_STATUS, report.status, to);
  if (report.status === "approved" && to === "draft") {
    throw new ApiError("CONFLICT", "已批准报告不可回退为草稿；请重新生成报告并完成审批");
  }
  if (report.status === "in_review" && to === "approved") {
    throw new ApiError("CONFLICT", "请在审批中心批准报告，不能绕过审批门");
  }
  if (to === "in_review") {
    if (expectedLockVersion === undefined) {
      throw new ApiError("VALIDATION_FAILED", "提交审批前请刷新报告版本");
    }
    const submitted = await analyticsRepository.submitReportForReview(
      ctx,
      id,
      expectedLockVersion,
    );
    if (submitted.kind === "not_found") throw new ApiError("RESOURCE_NOT_FOUND", "报告不存在");
    if (submitted.kind === "not_draft") {
      throw new ApiError("CONFLICT", "报告已进入审批或正式状态");
    }
    if (submitted.kind === "lock_conflict") {
      throw new ApiError("CONFLICT", "报告已被他人修改，请刷新后再提交审批");
    }
    return reportToDto(submitted.report);
  }
  const extra: Record<string, unknown> = {};
  if (to === "approved") {
    extra.approvedAt = new Date();
    extra.approvedBy = ctx.userId ?? null;
  }
  const transitioned = await analyticsRepository.transitionReport(
    ctx,
    id,
    report.status,
    to,
    reason ?? null,
    extra,
  );
  if (!transitioned) {
    throw new ApiError("CONFLICT", "报告状态已变化，请刷新后重试");
  }
  return getReport(ctx, id);
}

export async function decideReportCheckpoint(
  ctx: TenantCtx,
  checkpointId: string,
  reportId: string,
  decision: "approved" | "rejected" | "changes_requested",
  reason: string | null,
  expectedVersion?: number,
): Promise<void> {
  const result = await analyticsRepository.decideReportCheckpoint({
    ctx,
    checkpointId,
    reportId,
    decision,
    reason,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
  });
  if (result.kind === "not_pending") throw new ApiError("APPROVAL_ALREADY_DECIDED");
  if (result.kind === "report_conflict") {
    throw new ApiError("CONFLICT", "报告状态已变化，审批未提交");
  }
  if (result.kind === "integrity_mismatch") {
    throw new ApiError("CONFLICT", "报告内容与提交审批时不一致，审批已中止");
  }
}

export async function deriveReportDraft(
  ctx: TenantCtx,
  reportId: string,
  reason: string,
): Promise<ReportDto> {
  const result = await analyticsRepository.deriveReportDraft(ctx, reportId, reason);
  if (result.kind === "not_found") throw new ApiError("RESOURCE_NOT_FOUND", "报告不存在");
  if (result.kind === "not_formal") {
    throw new ApiError("CONFLICT", "只有已批准或已导出的正式版本可以创建修订草稿");
  }
  return getReport(ctx, result.report.id);
}

export async function createAnalyticsOutputsFromWorkflow(
  ctx: TenantCtx,
  campaignId: string,
  analytics: AnalyticsOutput,
  analyticsAgentRunId: string,
  report: ReportOutput,
  reportAgentRunId: string,
): Promise<{ report_id: string; insight_count: number }> {
  const [campaign, analyticsTrace, reportTrace] = await Promise.all([
    analyticsRepository.getCampaign(ctx, campaignId),
    analyticsRepository.getAgentRunTrace(analyticsAgentRunId),
    analyticsRepository.getAgentRunTrace(reportAgentRunId),
  ]);
  if (!campaign) throw new Error("Campaign 不存在");

  let insightCount = 0;
  for (const anomaly of analytics.anomalies) {
    await analyticsRepository.createInsight(ctx, {
      campaignId,
      kind: "anomaly",
      title: anomaly.title,
      content: `${anomaly.explanation}\n证据：${anomaly.evidence}`,
      severity: anomaly.severity,
      data: { source: "analytics_agent" },
      aiGenerated: true,
      agentRunId: analyticsAgentRunId,
      promptKey: analyticsTrace?.promptKey ?? null,
      promptVersion: analyticsTrace?.promptVersion ?? null,
      model: analyticsTrace?.model ?? null,
    });
    insightCount += 1;
  }
  for (const recommendation of analytics.recommendations) {
    await analyticsRepository.createInsight(ctx, {
      campaignId,
      kind: "opportunity",
      title: recommendation.action,
      content: `${recommendation.rationale}\n建议负责人：${recommendation.owner_hint}`,
      severity: "info",
      data: { source: "analytics_agent" },
      aiGenerated: true,
      agentRunId: analyticsAgentRunId,
      promptKey: analyticsTrace?.promptKey ?? null,
      promptVersion: analyticsTrace?.promptVersion ?? null,
      model: analyticsTrace?.model ?? null,
    });
    insightCount += 1;
  }

  const created = await analyticsRepository.createReport(ctx, {
    campaignId,
    title: report.title,
    kind: "campaign_retro",
    status: "approved",
    content: report as object,
    approvedAt: new Date(),
    approvedBy: ctx.userId ?? null,
    aiGenerated: true,
    agentRunId: reportAgentRunId,
    promptKey: reportTrace?.promptKey ?? null,
    promptVersion: reportTrace?.promptVersion ?? null,
    model: reportTrace?.model ?? null,
  });
  return { report_id: created.id, insight_count: insightCount };
}

export async function exportReport(
  ctx: TenantCtx,
  id: string,
  input: {
    format: "json_snapshot";
    recipient: string;
    purpose?: string | null;
    idempotency_key: string;
  },
): Promise<ReportExportResultDto> {
  const result = await analyticsRepository.createReportExport({
    ctx,
    reportId: id,
    format: input.format,
    recipient: input.recipient,
    purpose: input.purpose ?? null,
    idempotencyKey: input.idempotency_key,
  });
  if (result.kind === "not_exportable") {
    throw new ApiError("CONFLICT", "只有已批准或已导出的正式报告可以创建导出快照");
  }
  if (result.kind === "integrity_mismatch") {
    throw new ApiError("CONFLICT", "正式报告完整性校验失败，已阻止导出");
  }
  if (result.kind === "idempotency_conflict") {
    throw new ApiError("IDEMPOTENCY_CONFLICT", "该导出幂等键已用于其他报告");
  }
  return {
    report: reportToDto(result.report),
    export: reportExportToDto(result.exportRecord),
  };
}
