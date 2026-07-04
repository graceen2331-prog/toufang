import "server-only";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { campaignRepository } from "@/server/modules/campaign/campaign.repository";
import { CONTENT_ASSET_STATUS, CONTENT_REVIEW_STATUS, assertTransition } from "@/shared/constants/status";
import type { ContentReviewOutput } from "@/server/ai/prompts/content-review";
import { contentRepository } from "./content.repository";

export async function markReviewReviewing(ctx: TenantCtx, reviewId: string): Promise<void> {
  const review = await contentRepository.findReview(ctx, reviewId);
  if (!review) throw new Error("内容审核记录不存在");
  if (review.status === "reviewing") return;
  assertTransition(CONTENT_REVIEW_STATUS, review.status, "reviewing");
  await contentRepository.transitionReview(ctx, reviewId, review.status, "reviewing", "AI 开始审核");
}

export async function completeReviewFromWorkflow(
  ctx: TenantCtx,
  contentAssetId: string,
  reviewId: string,
  output: ContentReviewOutput,
  agentRunId: string,
): Promise<void> {
  const [asset, review, agentRun] = await Promise.all([
    contentRepository.findAsset(ctx, contentAssetId),
    contentRepository.findReview(ctx, reviewId),
    contentRepository.getAgentRunTrace(agentRunId),
  ]);
  if (!asset) throw new Error("内容资产不存在");
  if (!review) throw new Error("内容审核记录不存在");
  if (review.status !== "completed") {
    assertTransition(CONTENT_REVIEW_STATUS, review.status, "completed");
    await contentRepository.transitionReview(ctx, reviewId, review.status, "completed", "AI 审核完成并通过人工复核", {
      decision: output.decision,
      riskLevel: output.risk_level,
      findings: output.findings as unknown as object,
      feedback: output.creator_feedback,
      reviewerId: ctx.userId ?? null,
      aiGenerated: true,
      agentRunId,
      promptKey: agentRun?.promptKey ?? null,
      promptVersion: agentRun?.promptVersion ?? null,
      model: agentRun?.model ?? null,
      completedAt: new Date(),
    });
  }

  const target =
    output.decision === "approved"
      ? "approved"
      : output.decision === "rejected"
        ? "rejected"
        : "revision_requested";
  if (asset.status !== target) {
    let fromStatus = asset.status;
    if (fromStatus === "submitted") {
      await contentRepository.transitionAsset(ctx, contentAssetId, "submitted", "in_review", "内容审核结果补齐审核中状态");
      fromStatus = "in_review";
    }
    assertTransition(CONTENT_ASSET_STATUS, fromStatus, target);
    await contentRepository.transitionAsset(ctx, contentAssetId, fromStatus, target, "内容审核结果落地");
  }

  const nextSubStatus = output.decision === "approved" ? "approved" : "submitted";
  if (asset.campaignCreator.contentStatus !== nextSubStatus) {
    await campaignRepository.transitionCreatorField(
      ctx,
      asset.campaignCreatorId,
      "content_status",
      asset.campaignCreator.contentStatus,
      nextSubStatus,
      output.decision === "approved" ? "内容审核通过" : "内容需修改",
      "agent",
    );
  }
}

export async function rejectReviewFromWorkflow(
  ctx: TenantCtx,
  contentAssetId: string,
  reviewId: string | null,
  reason: string | null,
): Promise<void> {
  const asset = await contentRepository.findAsset(ctx, contentAssetId);
  if (!asset) return;
  if (reviewId) {
    const review = await contentRepository.findReview(ctx, reviewId);
    if (review && review.status !== "completed") {
      await contentRepository.transitionReview(ctx, review.id, review.status, "completed", "人工未通过内容审核", {
        decision: "needs_revision",
        riskLevel: "high",
        feedback: reason ?? "请根据审批意见修改后重新提交。",
        reviewerId: ctx.userId ?? null,
        completedAt: new Date(),
      });
    }
  }
  if (asset.status === "in_review") {
    await contentRepository.transitionAsset(ctx, contentAssetId, "in_review", "revision_requested", reason ?? "内容审核未通过");
  }
}
