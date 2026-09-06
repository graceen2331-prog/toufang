import "server-only";
import { prisma } from "@/server/db/client";
import { runAgent } from "@/server/ai/agents/run-agent";
import { discoveryPrompt, type DiscoveryOutput } from "@/server/ai/prompts/pipeline";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import { gatherCampaignContext } from "./research";
import type { WorkflowDefinition } from "../engine";

/**
 * 达人发现工作流：
 * 汇集上下文 → 库内候选检索 → discovery agent 匹配 → 审批（候选名单）→ 写入 campaign_creators
 */
export const creatorDiscoveryWorkflow: WorkflowDefinition = {
  key: "creator_discovery",
  label: "达人发现",
  manualRetrySafeStepKeys: ["gather_context", "search_candidates", "match_creators"],
  steps: [
    { key: "gather_context", label: "汇集上下文", run: gatherCampaignContext },
    {
      key: "search_candidates",
      label: "库内候选检索",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        // 排除黑名单/已归档 与 已在本 Campaign 中的达人
        const existing = await prisma.campaignCreator.findMany({
          where: { tenantId: ctx.tenantId, campaignId, deletedAt: null },
          select: { creatorId: true },
        });
        const excludeIds = existing.map((e) => e.creatorId);
        const candidates = await prisma.creator.findMany({
          where: {
            tenantId: ctx.tenantId,
            deletedAt: null,
            relationshipStatus: { notIn: ["blacklisted", "archived"] },
            ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
          },
          include: { platformAccounts: { where: { deletedAt: null } } },
          orderBy: { createdAt: "desc" },
          take: 30, // 控制上下文长度：一次评估至多 30 位
        });
        return {
          candidates: candidates.map((c, index) => ({
            index,
            creator_id: c.id,
            display_name: c.displayName,
            bio: c.bio,
            categories: c.categories,
            tags: c.tags,
            risk_level: c.riskLevel,
            relationship_status: c.relationshipStatus,
            accounts: c.platformAccounts.map((a) => ({
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
      key: "match_creators",
      label: "AI 匹配评估",
      run: async (ctx) => {
        const context = ctx.outputs.gather_context as Record<string, unknown>;
        const { candidates } = ctx.outputs.search_candidates as {
          candidates: Array<Record<string, unknown>>;
        };
        if (candidates.length === 0) {
          return { matches: [], note: "库内没有可评估的达人" };
        }
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "creator_discovery",
          workflowRunId: ctx.runId,
          prompt: discoveryPrompt,
          userMessage: `Campaign 上下文：\n${JSON.stringify(context, null, 2)}\n\n候选达人列表：\n${JSON.stringify(candidates, null, 2)}`,
          createdBy: ctx.createdBy,
        });
        // index → creator 映射
        const matches = output.matches
          .filter((m) => m.index < candidates.length)
          .map((m) => ({
            ...m,
            creator_id: candidates[m.index]!.creator_id as string,
            display_name: candidates[m.index]!.display_name as string,
          }));
        return { matches, agent_run_id: agentRunId };
      },
      checkpoint: {
        type: "shortlist",
        title: (ctx) =>
          `达人候选名单确认：${(ctx.outputs.gather_context as { campaign?: { name?: string } })?.campaign?.name ?? ""}`,
        summary: (_ctx, output) => {
          const matches = (output as { matches: unknown[] }).matches;
          return `AI 推荐 ${matches.length} 位候选达人，批准后将加入 Campaign 达人管道。`;
        },
        payload: (_ctx, output) => ({
          matches: (output as { matches: unknown[] }).matches,
        }),
        assigneeRole: "kol_manager",
      },
    },
    {
      key: "apply_candidates",
      label: "写入候选池",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        const { matches } = ctx.outputs.match_creators as {
          matches: Array<DiscoveryOutput["matches"][number] & { creator_id: string }>;
          agent_run_id?: string;
        };
        const agentRunId = (ctx.outputs.match_creators as { agent_run_id?: string }).agent_run_id;
        let added = 0;
        for (const match of matches) {
          const exists = await prisma.campaignCreator.findFirst({
            where: {
              tenantId: ctx.tenantId,
              campaignId,
              creatorId: match.creator_id,
              deletedAt: null,
            },
          });
          if (exists) continue;
          const cc = await prisma.campaignCreator.create({
            data: {
              tenantId: ctx.tenantId,
              campaignId,
              creatorId: match.creator_id,
              status: "candidate",
              role: match.suggested_role,
              matchScore: match.match_score,
              aiGenerated: true,
              agentRunId: agentRunId ?? null,
              createdBy: ctx.createdBy,
            },
          });
          await recordStatusEvent({
            tenantId: ctx.tenantId,
            entityType: "campaign_creator",
            entityId: cc.id,
            fromValue: null,
            toValue: "candidate",
            actorType: "agent",
            reason: `AI 发现（匹配分 ${match.match_score}）`,
          });
          added++;
        }
        return { added };
      },
    },
  ],
};
