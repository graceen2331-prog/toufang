import "server-only";
import { prisma } from "@/server/db/client";
import { runAgent } from "@/server/ai/agents/run-agent";
import { strategyPrompt, type StrategyOutput } from "@/server/ai/prompts/strategy";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import type { WorkflowDefinition } from "../engine";

/**
 * 策略生成工作流：
 * 1. gather_context —— 汇集品牌/产品/Campaign 上下文
 * 2. generate_strategy —— strategy agent 产出策略草案 → 人工审批门
 * 3. apply_strategy —— 落地策略版本 + Campaign 状态推进（draft → strategy）
 */
export const strategyWorkflow: WorkflowDefinition = {
  key: "strategy",
  label: "策略生成",
  steps: [
    {
      key: "gather_context",
      label: "汇集上下文",
      run: async (ctx) => {
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
        return {
          campaign: {
            name: campaign.name,
            objective: campaign.objective,
            markets: campaign.markets,
            platforms: campaign.platforms,
            budget_total_cents: campaign.budgetTotalCents,
            currency: campaign.currency,
            goals: campaign.goals,
            start_date: campaign.startDate?.toISOString().slice(0, 10) ?? null,
            end_date: campaign.endDate?.toISOString().slice(0, 10) ?? null,
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
                price: product.price,
              }
            : null,
        };
      },
    },
    {
      key: "generate_strategy",
      label: "生成策略草案",
      run: async (ctx) => {
        const context = ctx.outputs.gather_context as Record<string, unknown>;
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "strategy",
          workflowRunId: ctx.runId,
          prompt: strategyPrompt,
          userMessage: `请为以下 Campaign 生成达人营销策略：\n\n${JSON.stringify(context, null, 2)}`,
          input: context,
          createdBy: ctx.createdBy,
        });
        return { strategy: output, agent_run_id: agentRunId };
      },
      checkpoint: {
        type: "strategy",
        title: (ctx) => `策略草案审批：${(ctx.outputs.gather_context as { campaign?: { name?: string } })?.campaign?.name ?? "Campaign"}`,
        summary: (_ctx, output) =>
          ((output as { strategy?: StrategyOutput }).strategy?.summary ?? "").slice(0, 200),
        payload: (_ctx, output) => ({
          strategy: (output as { strategy?: StrategyOutput }).strategy ?? null,
        }),
        priority: "high",
        assigneeRole: "manager",
      },
    },
    {
      key: "apply_strategy",
      label: "落地策略版本",
      run: async (ctx) => {
        const campaignId = ctx.run.subjectId!;
        const genOutput = ctx.outputs.generate_strategy as {
          strategy: StrategyOutput;
          agent_run_id: string;
        };
        const agentRun = await prisma.agentRun.findUnique({
          where: { id: genOutput.agent_run_id },
          select: { promptKey: true, promptVersion: true, model: true },
        });

        const version = await prisma.$transaction(async (tx) => {
          const last = await tx.campaignStrategyVersion.findFirst({
            where: { tenantId: ctx.tenantId, campaignId },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const created = await tx.campaignStrategyVersion.create({
            data: {
              tenantId: ctx.tenantId,
              campaignId,
              version: (last?.version ?? 0) + 1,
              status: "approved", // 经审批门后落地
              content: genOutput.strategy as object,
              summary: genOutput.strategy.summary,
              aiGenerated: true,
              agentRunId: genOutput.agent_run_id,
              promptKey: agentRun?.promptKey ?? null,
              promptVersion: agentRun?.promptVersion ?? null,
              model: agentRun?.model ?? null,
              approvedAt: new Date(),
              approvedBy: ctx.createdBy,
              createdBy: ctx.createdBy,
            },
          });

          // Campaign 若在 draft，推进到 strategy 阶段
          const campaign = await tx.campaign.findFirst({
            where: { id: campaignId, tenantId: ctx.tenantId },
            select: { status: true },
          });
          if (campaign?.status === "draft") {
            await tx.campaign.updateMany({
              where: { id: campaignId, tenantId: ctx.tenantId },
              data: { status: "strategy" },
            });
            await recordStatusEvent(
              {
                tenantId: ctx.tenantId,
                entityType: "campaign",
                entityId: campaignId,
                fromValue: "draft",
                toValue: "strategy",
                actorType: "system",
                reason: "策略生成工作流完成",
              },
              tx,
            );
          }
          return created;
        });

        return { strategy_version_id: version.id, version: version.version };
      },
    },
  ],
};
