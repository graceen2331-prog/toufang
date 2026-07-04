import "server-only";
import { prisma } from "@/server/db/client";
import { runAgent } from "@/server/ai/agents/run-agent";
import { contentReviewPrompt, type ContentReviewOutput } from "@/server/ai/prompts/content-review";
import {
  completeReviewFromWorkflow,
  markReviewReviewing,
  rejectReviewFromWorkflow,
} from "@/server/modules/content/content.workflow-actions";
import { contentRepository } from "@/server/modules/content/content.repository";
import type { StepContext, WorkflowDefinition } from "../engine";

function tenantCtx(ctx: StepContext) {
  return { orgId: ctx.tenantId, ...(ctx.createdBy ? { userId: ctx.createdBy } : {}) };
}

function workflowInput(ctx: StepContext): { review_id?: string; instruction?: string | null } {
  return (ctx.run.input as { review_id?: string; instruction?: string | null }) ?? {};
}

async function gatherContentContext(ctx: StepContext): Promise<Record<string, unknown>> {
  const contentAssetId = ctx.run.subjectId;
  if (!contentAssetId) throw new Error("缺少内容资产上下文");
  const reviewContext = await contentRepository.getReviewContext(
    tenantCtx(ctx),
    contentAssetId,
  );
  if (!reviewContext) throw new Error("内容资产缺少已批准 Brief，无法审核");

  const { asset, briefVersion } = reviewContext;
  return {
    content_asset: {
      id: asset.id,
      title: asset.title,
      content_type: asset.contentType,
      platform: asset.platform,
      caption: asset.caption,
      transcript: asset.transcript,
      url: asset.url,
    },
    campaign: {
      id: asset.campaignCreator.campaign.id,
      name: asset.campaignCreator.campaign.name,
      objective: asset.campaignCreator.campaign.objective,
      goals: asset.campaignCreator.campaign.goals,
    },
    creator: {
      id: asset.campaignCreator.creator.id,
      display_name: asset.campaignCreator.creator.displayName,
    },
    brief: {
      id: asset.brief?.id,
      title: asset.brief?.title,
      content: briefVersion.content,
      plain_text: briefVersion.plainText,
    },
    brand: {
      name: asset.campaignCreator.campaign.brand.name,
      guidelines: asset.campaignCreator.campaign.brand.guidelines,
      restricted_terms: asset.campaignCreator.campaign.brand.restrictedTerms,
    },
    platform_rules: {
      general: ["不得使用绝对化用语", "功效表达必须与 Brief 一致", "外链与购物车露出遵守平台规则"],
      platform: asset.platform,
    },
    instruction: workflowInput(ctx).instruction ?? null,
  };
}

export const contentReviewWorkflow: WorkflowDefinition = {
  key: "content_review",
  label: "内容审核",
  steps: [
    { key: "gather_context", label: "汇集审核上下文", run: gatherContentContext },
    {
      key: "evaluate_content",
      label: "AI 审核内容",
      run: async (ctx) => {
        const input = workflowInput(ctx);
        if (input.review_id) {
          await markReviewReviewing(
            tenantCtx(ctx),
            input.review_id,
          );
        }
        const context = ctx.outputs.gather_context as Record<string, unknown>;
        const { output, agentRunId } = await runAgent({
          tenantId: ctx.tenantId,
          agentKey: "content_review",
          workflowRunId: ctx.runId,
          prompt: contentReviewPrompt,
          userMessage: `请审核以下达人内容：\n\n${JSON.stringify(context, null, 2)}`,
          createdBy: ctx.createdBy,
        });
        return { review: output, agent_run_id: agentRunId };
      },
      checkpoint: {
        type: "content",
        title: (_ctx, output) => {
          const review = (output as { review?: ContentReviewOutput }).review;
          return `内容审核复核：${review?.risk_level === "high" ? "高风险" : "AI 建议"}`;
        },
        summary: (_ctx, output) => {
          const review = (output as { review?: ContentReviewOutput }).review;
          return review?.creator_feedback?.slice(0, 200) ?? "";
        },
        payload: (_ctx, output) => ({
          review: (output as { review?: ContentReviewOutput }).review ?? null,
        }),
        priority: "high",
        assigneeRole: "content_manager",
      },
    },
    {
      key: "apply_review",
      label: "落地审核结果",
      run: async (ctx) => {
        const contentAssetId = ctx.run.subjectId!;
        const input = workflowInput(ctx);
        const gen = ctx.outputs.evaluate_content as {
          review: ContentReviewOutput;
          agent_run_id: string;
        };
        if (!input.review_id) throw new Error("缺少内容审核记录");
        await completeReviewFromWorkflow(
          tenantCtx(ctx),
          contentAssetId,
          input.review_id,
          gen.review,
          gen.agent_run_id,
        );
        return { content_asset_id: contentAssetId, review_id: input.review_id, decision: gen.review.decision };
      },
    },
  ],
  onRejected: async (ctx, reason) => {
    const contentAssetId = ctx.run.subjectId;
    if (!contentAssetId) return;
    const input = workflowInput(ctx);
    const waiting = await prisma.workflowStep.findFirst({
      where: { tenantId: ctx.tenantId, runId: ctx.runId, stepKey: "evaluate_content" },
      select: { output: true },
    });
    const review = (waiting?.output as { review?: ContentReviewOutput } | null)?.review;
    await rejectReviewFromWorkflow(
      tenantCtx(ctx),
      contentAssetId,
      input.review_id ?? null,
      reason ?? review?.creator_feedback ?? "内容审核未通过",
    );
  },
};
