import "server-only";
import { runAgent } from "@/server/ai/agents/run-agent";
import { analyticsPrompt, type AnalyticsOutput } from "@/server/ai/prompts/analytics";
import { reportPrompt, type ReportOutput } from "@/server/ai/prompts/report";
import { analyticsRepository } from "@/server/modules/analytics/analytics.repository";
import { createAnalyticsOutputsFromWorkflow } from "@/server/modules/analytics/analytics.workflow-actions";
import type { StepContext, WorkflowDefinition } from "../engine";

function tenantCtx(ctx: StepContext) {
  return { orgId: ctx.tenantId, ...(ctx.createdBy ? { userId: ctx.createdBy } : {}) };
}

function runInput(ctx: StepContext): { date_from?: string | null; date_to?: string | null } {
  return (ctx.run.input as { date_from?: string | null; date_to?: string | null }) ?? {};
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function sumMetrics(rows: Array<{ metrics: unknown }>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const metrics = row.metrics && typeof row.metrics === "object" ? (row.metrics as Record<string, unknown>) : {};
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === "number" && Number.isFinite(value)) totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}

export const analyticsWorkflow: WorkflowDefinition = {
  key: "analytics",
  label: "效果分析",
  steps: [
    {
      key: "gather_metrics",
      label: "采集指标",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId;
        if (!campaignId) throw new Error("缺少 Campaign 上下文");
        const input = runInput(ctx);
        const [campaign, metrics] = await Promise.all([
          analyticsRepository.getCampaign(tenantCtx(ctx), campaignId),
          analyticsRepository.listMetrics(
            tenantCtx(ctx),
            { campaignId, dateFrom: parseDate(input.date_from), dateTo: parseDate(input.date_to) },
          ),
        ]);
        if (!campaign) throw new Error("Campaign 不存在");
        return {
          campaign: {
            id: campaign.id,
            name: campaign.name,
            goals: campaign.goals,
            budget_total_cents: campaign.budgetTotalCents,
          },
          date_range: { from: input.date_from ?? null, to: input.date_to ?? null },
          metrics: metrics.map((metric) => ({
            entity_type: metric.entityType,
            entity_id: metric.entityId,
            label: metric.label,
            platform: metric.platform,
            metric_date: metric.metricDate.toISOString().slice(0, 10),
            metrics: metric.metrics,
          })),
        };
      },
    },
    {
      key: "normalize_metrics",
      label: "归一化指标",
      run: async (ctx) => {
        const gathered = ctx.outputs.gather_metrics as { metrics?: Array<{ metrics: unknown }> };
        return {
          metrics: gathered.metrics ?? [],
          row_count: gathered.metrics?.length ?? 0,
        };
      },
    },
    {
      key: "compute_kpis",
      label: "计算 KPI",
      run: async (ctx) => {
        const gathered = ctx.outputs.gather_metrics as { campaign?: unknown; date_range?: unknown };
        const normalized = ctx.outputs.normalize_metrics as { metrics?: Array<{ metrics: unknown }> };
        const totals = sumMetrics(normalized.metrics ?? []);
        const engagements = (totals.likes ?? 0) + (totals.comments ?? 0) + (totals.shares ?? 0);
        return {
          campaign: gathered.campaign,
          date_range: gathered.date_range,
          totals,
          kpis: {
            engagement_rate: totals.impressions ? engagements / totals.impressions : null,
            ctr: totals.impressions ? (totals.clicks ?? 0) / totals.impressions : null,
            roi: totals.cost_cents ? (totals.revenue_cents ?? 0) / totals.cost_cents : null,
          },
        };
      },
    },
    {
      key: "analyze_metrics",
      label: "AI 生成洞察",
      run: async (ctx) => {
        const context = {
          gathered: ctx.outputs.gather_metrics,
          computed: ctx.outputs.compute_kpis,
        };
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "analytics",
          workflowRunId: ctx.runId,
          prompt: analyticsPrompt,
          userMessage: `请分析以下 Campaign 指标，不得编造缺失数据：\n\n${JSON.stringify(context, null, 2)}`,
          createdBy: ctx.createdBy,
        });
        return { analytics: output, agent_run_id: agentRunId };
      },
    },
    {
      key: "draft_report",
      label: "AI 生成报告草案",
      run: async (ctx) => {
        const context = {
          gathered: ctx.outputs.gather_metrics,
          computed: ctx.outputs.compute_kpis,
          analytics: (ctx.outputs.analyze_metrics as { analytics?: AnalyticsOutput }).analytics,
        };
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "report",
          workflowRunId: ctx.runId,
          prompt: reportPrompt,
          userMessage: `请生成需要人工审批的 Campaign 复盘报告：\n\n${JSON.stringify(context, null, 2)}`,
          createdBy: ctx.createdBy,
        });
        return { report: output, agent_run_id: agentRunId };
      },
      checkpoint: {
        type: "report",
        title: (_ctx, output) => `报告审批：${(output as { report?: ReportOutput }).report?.title ?? ""}`,
        summary: (_ctx, output) =>
          ((output as { report?: ReportOutput }).report?.executive_summary ?? "").slice(0, 200),
        payload: (_ctx, output) => ({
          report: (output as { report?: ReportOutput }).report ?? null,
        }),
        priority: "high",
        assigneeRole: "manager",
      },
    },
    {
      key: "save_outputs",
      label: "保存洞察与报告",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        const analytics = ctx.outputs.analyze_metrics as { analytics: AnalyticsOutput; agent_run_id: string };
        const report = ctx.outputs.draft_report as { report: ReportOutput; agent_run_id: string };
        return createAnalyticsOutputsFromWorkflow(
          tenantCtx(ctx),
          campaignId,
          analytics.analytics,
          analytics.agent_run_id,
          report.report,
          report.agent_run_id,
        );
      },
    },
  ],
};
