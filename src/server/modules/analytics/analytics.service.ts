import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { startWorkflow } from "@/server/workflows/engine";
import { checkpointRepository } from "@/server/modules/checkpoint/checkpoint.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { REPORT_STATUS, assertTransition } from "@/shared/constants/status";
import type { StartWorkflowResponseDto } from "@/shared/schemas/workflow";
import type { AnalyticsOutput } from "@/server/ai/prompts/analytics";
import type { ReportOutput } from "@/server/ai/prompts/report";
import type {
  Insight,
  PerformanceMetric,
  Prisma,
  Report,
  WorkflowRun,
} from "@/generated/prisma/client";
import type {
  AnalyticsOverviewDto,
  InsightDto,
  MetricDto,
  MetricUpsertInput,
  ReportDto,
} from "@/shared/schemas/content-analytics";
import {
  analyticsRepository,
  type AnalyticsQueryParams,
  type InsightListParams,
  type MetricWithLabel,
  type ReportListParams,
} from "./analytics.repository";

const METRIC_KEYS = [
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

function asMetricMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) result[key] = raw;
  }
  return result;
}

export function sumMetricRows(rows: Array<{ metrics: unknown }>): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(METRIC_KEYS.map((key) => [key, 0]));
  for (const row of rows) {
    const metrics = asMetricMap(row.metrics);
    for (const key of METRIC_KEYS) totals[key] = (totals[key] ?? 0) + (metrics[key] ?? 0);
  }
  return totals;
}

export function calculateKpis(totals: Record<string, number>): AnalyticsOverviewDto["kpis"] {
  const engagements = (totals.likes ?? 0) + (totals.comments ?? 0) + (totals.shares ?? 0);
  const impressions = totals.impressions ?? 0;
  const clicks = totals.clicks ?? 0;
  const conversions = totals.conversions ?? 0;
  const revenue = totals.revenue_cents ?? 0;
  const cost = totals.cost_cents ?? 0;
  return {
    engagement_rate: impressions > 0 ? engagements / impressions : null,
    ctr: impressions > 0 ? clicks / impressions : null,
    conversion_rate: clicks > 0 ? conversions / clicks : null,
    roi: cost > 0 ? revenue / cost : null,
    cpa_cents: conversions > 0 ? Math.round(cost / conversions) : null,
  };
}

function metricToDto(metric: PerformanceMetric): MetricDto {
  return {
    id: metric.id,
    entity_type: metric.entityType,
    entity_id: metric.entityId,
    platform: metric.platform,
    metric_date: metric.metricDate.toISOString().slice(0, 10),
    metrics: asMetricMap(metric.metrics),
    source: metric.source,
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

function reportToDto(report: Report): ReportDto {
  return {
    id: report.id,
    campaign_id: report.campaignId,
    title: report.title,
    kind: report.kind,
    status: report.status,
    content: (report.content as Record<string, unknown>) ?? {},
    approved_at: report.approvedAt?.toISOString() ?? null,
    approved_by: report.approvedBy,
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
  type SeriesBucket = {
    views: number;
    engagements: number;
    conversions: number;
    revenue_cents: number;
  };
  const byDate = new Map<string, SeriesBucket>();
  for (const row of rows) {
    const key = row.metricDate.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? {
      views: 0,
      engagements: 0,
      conversions: 0,
      revenue_cents: 0,
    };
    const metrics = asMetricMap(row.metrics);
    bucket.views += metrics.views ?? 0;
    bucket.engagements += (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0);
    bucket.conversions += metrics.conversions ?? 0;
    bucket.revenue_cents += metrics.revenue_cents ?? 0;
    byDate.set(key, bucket);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => ({ date, ...metrics }));
}

export function rankPerformers(
  rows: Array<Pick<MetricWithLabel, "entityType" | "entityId" | "label" | "metrics">>,
): {
  top: AnalyticsOverviewDto["top_performers"];
  low: AnalyticsOverviewDto["low_performers"];
} {
  const byEntity = new Map<
    string,
    { entityType: string; entityId: string; label: string; metrics: Record<string, number> }
  >();
  for (const row of rows) {
    if (row.entityType === "campaign") continue;
    const key = `${row.entityType}:${row.entityId}`;
    const bucket = byEntity.get(key) ?? {
      entityType: row.entityType,
      entityId: row.entityId,
      label: row.label,
      metrics: {},
    };
    const metrics = asMetricMap(row.metrics);
    for (const metricKey of METRIC_KEYS) {
      bucket.metrics[metricKey] = (bucket.metrics[metricKey] ?? 0) + (metrics[metricKey] ?? 0);
    }
    byEntity.set(key, bucket);
  }
  const ranked = [...byEntity.values()]
    .map((item) => ({
      entity_id: item.entityId,
      entity_type: item.entityType,
      label: item.label,
      score:
        (item.metrics.views ?? 0) +
        (item.metrics.likes ?? 0) * 5 +
        (item.metrics.comments ?? 0) * 8 +
        (item.metrics.shares ?? 0) * 10 +
        (item.metrics.conversions ?? 0) * 50,
      metrics: item.metrics,
    }))
    .sort((a, b) => b.score - a.score);
  const topCount = Math.min(5, Math.ceil(ranked.length / 2));
  return {
    top: ranked.slice(0, topCount),
    low: ranked.slice(topCount).slice(-5).reverse(),
  };
}

function dataQualityNotes(rows: MetricWithLabel[], totals: Record<string, number>): string[] {
  const notes: string[] = [];
  if (rows.length === 0) notes.push("当前筛选范围内没有指标数据。");
  if ((totals.revenue_cents ?? 0) === 0) notes.push("缺少收入字段，ROI 暂不可完整判断。");
  if ((totals.cost_cents ?? 0) === 0) notes.push("缺少成本字段，CPA/ROI 仅可作为方向参考。");
  return notes;
}

export async function upsertMetric(ctx: TenantCtx, input: MetricUpsertInput): Promise<MetricDto> {
  const metric = await analyticsRepository.upsertMetric(ctx, {
    entityType: input.entity_type,
    entityId: input.entity_id,
    platform: input.platform ?? "all",
    metricDate: parseDate(input.metric_date)!,
    metrics: input.metrics,
    source: input.source,
  });
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
  const [rows, insightPage] = await Promise.all([
    analyticsRepository.listMetrics(ctx, query),
    analyticsRepository.listInsights(ctx, {
      limit: 20,
      cursor: null,
      order: "desc",
      campaignId: query.campaignId,
      status: "open",
    }),
  ]);
  const totals = sumMetricRows(rows);
  const ranked = rankPerformers(rows);
  return {
    campaign_id: query.campaignId,
    date_from: params.dateFrom ?? null,
    date_to: params.dateTo ?? null,
    totals,
    kpis: calculateKpis(totals),
    series: buildSeries(rows),
    top_performers: ranked.top,
    low_performers: ranked.low,
    data_quality_notes: dataQualityNotes(rows, totals),
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
  input: { title?: string; content?: Record<string, unknown> },
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
  const report = await analyticsRepository.updateReport(ctx, id, {
    ...(input.title ? { title: input.title } : {}),
    ...(input.content ? { content: input.content as Prisma.InputJsonValue } : {}),
  });
  if (!report) throw new ApiError("RESOURCE_NOT_FOUND", "报告不存在");
  return reportToDto(report);
}

export async function transitionReportStatus(
  ctx: TenantCtx,
  id: string,
  to: string,
  reason?: string | null,
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
  const extra: Record<string, unknown> = {};
  if (to === "approved") {
    extra.approvedAt = new Date();
    extra.approvedBy = ctx.userId ?? null;
  }
  await analyticsRepository.transitionReport(ctx, id, report.status, to, reason ?? null, extra);
  if (to === "in_review") {
    await checkpointRepository.create(ctx, {
      type: "report",
      status: "pending",
      title: `报告审批：${report.title}`,
      summary: String(
        (report.content as { executive_summary?: string })?.executive_summary ?? "",
      ).slice(0, 200),
      entityType: "report",
      entityId: id,
      payload: { report_id: id, title: report.title, content: report.content as object },
      priority: "high",
      assigneeRole: "manager",
    });
  }
  return getReport(ctx, id);
}

export async function onReportApprovalDecided(
  ctx: TenantCtx,
  reportId: string,
  decision: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  const report = await analyticsRepository.findReport(ctx, reportId);
  if (!report || report.status !== "in_review") return;
  if (decision === "approved") {
    await analyticsRepository.transitionReport(
      ctx,
      reportId,
      "in_review",
      "approved",
      "报告审批通过",
      {
        approvedAt: new Date(),
        approvedBy: ctx.userId ?? null,
      },
    );
  } else {
    await analyticsRepository.transitionReport(
      ctx,
      reportId,
      "in_review",
      "draft",
      "报告审批退回修改",
    );
  }
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

export async function exportReport(ctx: TenantCtx, id: string): Promise<ReportDto> {
  return transitionReportStatus(ctx, id, "exported", "报告导出");
}
