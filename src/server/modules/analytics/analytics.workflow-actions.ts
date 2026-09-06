import "server-only";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import type { AnalyticsOutput } from "@/server/ai/prompts/analytics";
import type { ReportOutput } from "@/server/ai/prompts/report";
import { analyticsRepository } from "./analytics.repository";

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
