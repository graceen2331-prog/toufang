import "server-only";
import { prisma } from "@/server/db/client";
import { runAgent } from "@/server/ai/agents/run-agent";
import { scoringPrompt, type ScoringOutput } from "@/server/ai/prompts/pipeline";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import { gatherCampaignContext } from "./research";
import type { WorkflowDefinition } from "../engine";

/**
 * 达人评分工作流：
 * 汇集上下文 → 收集候选（candidate 状态）→ scoring agent 六维评分 → 审批（入围名单）→ 落分 + 状态推进
 */
export const creatorScoringWorkflow: WorkflowDefinition = {
  key: "creator_scoring",
  label: "达人评分",
  manualRetrySafeStepKeys: ["gather_context", "collect_candidates", "score_creators"],
  steps: [
    { key: "gather_context", label: "汇集上下文", run: gatherCampaignContext },
    {
      key: "collect_candidates",
      label: "收集待评分候选",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        const ccs = await prisma.campaignCreator.findMany({
          where: {
            tenantId: ctx.tenantId,
            campaignId,
            status: "candidate",
            deletedAt: null,
          },
          include: {
            creator: { include: { platformAccounts: { where: { deletedAt: null } } } },
          },
          take: 30,
        });
        if (ccs.length === 0) throw new Error("没有处于候选状态的达人，请先运行达人发现");
        return {
          candidates: ccs.map((cc, index) => ({
            index,
            campaign_creator_id: cc.id,
            creator_id: cc.creatorId,
            display_name: cc.creator.displayName,
            bio: cc.creator.bio,
            categories: cc.creator.categories,
            risk_level: cc.creator.riskLevel,
            match_score: cc.matchScore,
            role: cc.role,
            quoted_price_cents: cc.quotedPriceCents,
            accounts: cc.creator.platformAccounts.map((a) => ({
              platform: a.platform,
              followers: a.followers,
              engagement_rate: a.engagementRate,
              avg_views: a.avgViews,
            })),
          })),
        };
      },
    },
    {
      key: "score_creators",
      label: "AI 六维评分",
      run: async (ctx) => {
        const context = ctx.outputs.gather_context as Record<string, unknown>;
        const { candidates } = ctx.outputs.collect_candidates as {
          candidates: Array<Record<string, unknown>>;
        };
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "creator_scoring",
          workflowRunId: ctx.runId,
          prompt: scoringPrompt,
          userMessage: `Campaign 上下文：\n${JSON.stringify(context, null, 2)}\n\n候选达人（含前置匹配分）：\n${JSON.stringify(candidates, null, 2)}`,
          createdBy: ctx.createdBy,
        });
        const scores = output.scores
          .filter((s) => s.index < candidates.length)
          .map((s) => ({
            ...s,
            campaign_creator_id: candidates[s.index]!.campaign_creator_id as string,
            creator_id: candidates[s.index]!.creator_id as string,
            display_name: candidates[s.index]!.display_name as string,
          }));
        return { scores, agent_run_id: agentRunId };
      },
      checkpoint: {
        type: "shortlist",
        title: (ctx) =>
          `达人入围名单审批：${(ctx.outputs.gather_context as { campaign?: { name?: string } })?.campaign?.name ?? ""}`,
        summary: (_ctx, output) => {
          const scores = (output as { scores: Array<{ shortlist: boolean }> }).scores;
          const shortlisted = scores.filter((s) => s.shortlist).length;
          return `AI 完成 ${scores.length} 位达人评分，建议 ${shortlisted} 位入围。批准后入围达人推进到 shortlisted。`;
        },
        payload: (_ctx, output) => ({ scores: (output as { scores: unknown[] }).scores }),
        priority: "high",
        assigneeRole: "manager",
      },
    },
    {
      key: "apply_scores",
      label: "落分与状态推进",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        const { scores } = ctx.outputs.score_creators as {
          scores: Array<
            ScoringOutput["scores"][number] & { campaign_creator_id: string; creator_id: string }
          >;
        };
        const agentRunId = (ctx.outputs.score_creators as { agent_run_id?: string }).agent_run_id;
        const agentRun = agentRunId
          ? await prisma.agentRun.findUnique({
              where: { id: agentRunId },
              select: { promptKey: true, promptVersion: true, model: true },
            })
          : null;

        let shortlisted = 0;
        for (const score of scores) {
          await prisma.creatorScore.create({
            data: {
              tenantId: ctx.tenantId,
              creatorId: score.creator_id,
              campaignId,
              overallScore: score.overall_score,
              tier: score.tier,
              dimensions: score.dimensions as object,
              risk: score.risk as object,
              explanation: score.explanation,
              aiGenerated: true,
              agentRunId: agentRunId ?? null,
              promptKey: agentRun?.promptKey ?? null,
              promptVersion: agentRun?.promptVersion ?? null,
              model: agentRun?.model ?? null,
              createdBy: ctx.createdBy,
            },
          });
          const toStatus = score.shortlist ? "shortlisted" : "scored";
          await prisma.campaignCreator.updateMany({
            where: { id: score.campaign_creator_id, tenantId: ctx.tenantId, deletedAt: null },
            data: { status: toStatus },
          });
          await recordStatusEvent({
            tenantId: ctx.tenantId,
            entityType: "campaign_creator",
            entityId: score.campaign_creator_id,
            fromValue: "candidate",
            toValue: toStatus,
            actorType: "agent",
            reason: `评分 ${score.overall_score}（${score.tier} 级）${score.shortlist ? "，AI 建议入围" : ""}`,
          });
          if (score.shortlist) shortlisted++;
        }
        return { scored: scores.length, shortlisted };
      },
    },
  ],
};
