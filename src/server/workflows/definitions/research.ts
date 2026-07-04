import "server-only";
import { prisma } from "@/server/db/client";
import { runAgent } from "@/server/ai/agents/run-agent";
import { researchPrompt, type ResearchOutput } from "@/server/ai/prompts/pipeline";
import type { WorkflowDefinition, StepContext } from "../engine";

/** 汇集 Campaign + 品牌 + 产品 + 最新策略上下文（多个工作流复用） */
export async function gatherCampaignContext(ctx: StepContext): Promise<Record<string, unknown>> {
  const campaignId = ctx.run.subjectId;
  if (!campaignId) throw new Error("缺少 campaign 上下文");
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId: ctx.tenantId, deletedAt: null },
    include: { brand: true },
  });
  if (!campaign) throw new Error("Campaign 不存在");
  const product = campaign.productId
    ? await prisma.product.findFirst({
        where: { id: campaign.productId, tenantId: ctx.tenantId, deletedAt: null },
      })
    : null;
  const latestStrategy = await prisma.campaignStrategyVersion.findFirst({
    where: { tenantId: ctx.tenantId, campaignId, status: "approved", deletedAt: null },
    orderBy: { version: "desc" },
  });
  return {
    campaign: {
      name: campaign.name,
      objective: campaign.objective,
      markets: campaign.markets,
      platforms: campaign.platforms,
      budget_total_cents: campaign.budgetTotalCents,
      goals: campaign.goals,
    },
    brand: {
      name: campaign.brand.name,
      industry: campaign.brand.industry,
      description: campaign.brand.description,
      guidelines: campaign.brand.guidelines,
      restricted_terms: campaign.brand.restrictedTerms,
    },
    product: product
      ? {
          name: product.name,
          category: product.category,
          description: product.description,
          key_claims: product.keyClaims,
          restricted_claims: product.restrictedClaims,
        }
      : null,
    strategy: latestStrategy ? latestStrategy.content : null,
  };
}

/**
 * 市场研究工作流：汇集上下文 → research agent → 审批 → 存入洞察 + 知识文档
 */
export const researchWorkflow: WorkflowDefinition = {
  key: "research",
  label: "市场研究",
  steps: [
    { key: "gather_context", label: "汇集上下文", run: gatherCampaignContext },
    {
      key: "generate_research",
      label: "生成研究报告",
      run: async (ctx) => {
        const context = ctx.outputs.gather_context as Record<string, unknown>;
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "research",
          workflowRunId: ctx.runId,
          prompt: researchPrompt,
          userMessage: `请为以下 Campaign 做市场与竞品研究：\n\n${JSON.stringify(context, null, 2)}`,
          createdBy: ctx.createdBy,
        });
        return { research: output, agent_run_id: agentRunId };
      },
      checkpoint: {
        type: "strategy",
        title: (ctx) =>
          `市场研究报告审阅：${(ctx.outputs.gather_context as { campaign?: { name?: string } })?.campaign?.name ?? ""}`,
        summary: (_ctx, output) =>
          ((output as { research?: ResearchOutput }).research?.market_overview ?? "").slice(0, 200),
        payload: (_ctx, output) => ({
          research: (output as { research?: ResearchOutput }).research ?? null,
        }),
        assigneeRole: "manager",
      },
    },
    {
      key: "save_research",
      label: "保存研究成果",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        const gen = ctx.outputs.generate_research as {
          research: ResearchOutput;
          agent_run_id: string;
        };
        // 风险与建议落为洞察
        for (const risk of gen.research.risks) {
          await prisma.insight.create({
            data: {
              tenantId: ctx.tenantId,
              campaignId,
              kind: "risk",
              title: risk.risk,
              content: `缓解措施：${risk.mitigation}`,
              severity: risk.severity === "high" ? "critical" : risk.severity === "medium" ? "warning" : "info",
              aiGenerated: true,
              agentRunId: gen.agent_run_id,
            },
          });
        }
        // 报告全文进知识库（type=research；W8 接入 RAG 索引）
        const doc = await prisma.knowledgeDocument.create({
          data: {
            tenantId: ctx.tenantId,
            title: `市场研究：${(ctx.outputs.gather_context as { campaign?: { name?: string } })?.campaign?.name ?? "Campaign"}`,
            type: "research",
            status: "uploaded",
            sourceType: "research",
            sourceId: campaignId,
            campaignId,
            content: JSON.stringify(gen.research, null, 2),
            aiGenerated: true,
            agentRunId: gen.agent_run_id,
            createdBy: ctx.createdBy,
          },
        });
        return { knowledge_document_id: doc.id, insight_count: gen.research.risks.length };
      },
    },
  ],
};
