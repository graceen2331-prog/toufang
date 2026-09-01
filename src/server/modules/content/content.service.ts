import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { startWorkflow } from "@/server/workflows/engine";
import { campaignRepository } from "@/server/modules/campaign/campaign.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import {
  CONTENT_ASSET_STATUS,
  CONTENT_REVIEW_STATUS,
  assertTransition,
} from "@/shared/constants/status";
import type { StartWorkflowResponseDto } from "@/shared/schemas/workflow";
import type { CheckpointDecisionInput } from "@/shared/schemas/checkpoint";
import type {
  ContentAssetDto,
  ContentReviewDto,
  ContentReviewFindingDto,
} from "@/shared/schemas/content-analytics";
import type { ContentReviewOutput } from "@/server/ai/prompts/content-review";
import type { ContentReview, WorkflowRun } from "@/generated/prisma/client";
import {
  contentRepository,
  type ContentAssetListParams,
  type ContentAssetWithRelations,
} from "./content.repository";

function findingsFromJson(value: unknown): ContentReviewFindingDto[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        ...(typeof row.id === "string" ? { id: row.id } : {}),
        type: typeof row.type === "string" ? row.type : "unknown",
        severity:
          row.severity === "high" || row.severity === "medium" || row.severity === "low"
            ? row.severity
            : "low",
        quote: typeof row.quote === "string" ? row.quote : null,
        issue: typeof row.issue === "string" ? row.issue : "",
        suggestion: typeof row.suggestion === "string" ? row.suggestion : "",
        ...(row.origin === "deterministic" || row.origin === "ai" ? { origin: row.origin } : {}),
        ...(row.source === "brand" ||
        row.source === "brief" ||
        row.source === "platform" ||
        row.source === "system" ||
        row.source === "ai"
          ? { source: row.source }
          : {}),
        ...(typeof row.rule_id === "string" ? { rule_id: row.rule_id } : {}),
        ...(typeof row.rule_version === "string" ? { rule_version: row.rule_version } : {}),
        ...(typeof row.blocking === "boolean" ? { blocking: row.blocking } : {}),
        ...(row.field === "caption" || row.field === "transcript" || row.field === "combined"
          ? { field: row.field }
          : {}),
      };
    })
    .filter((item): item is ContentReviewFindingDto => !!item && !!item.issue);
}

function reviewToDto(review: ContentReview): ContentReviewDto {
  return {
    id: review.id,
    content_asset_id: review.contentAssetId,
    status: review.status,
    decision: review.decision,
    risk_level: review.riskLevel,
    findings: findingsFromJson(review.findings),
    feedback: review.feedback,
    reviewer_id: review.reviewerId,
    input_hash: review.inputHash,
    rule_set_version: review.ruleSetVersion,
    final_decision: review.finalDecision,
    checkpoint_id: review.checkpointId,
    normalization_notes: Array.isArray(review.normalizationNotes)
      ? review.normalizationNotes.filter((item): item is string => typeof item === "string")
      : [],
    override_metadata:
      review.overrideMetadata && typeof review.overrideMetadata === "object"
        ? (review.overrideMetadata as Record<string, unknown>)
        : {},
    ai_generated: review.aiGenerated,
    model: review.model,
    prompt_key: review.promptKey,
    prompt_version: review.promptVersion,
    completed_at: review.completedAt?.toISOString() ?? null,
    created_at: review.createdAt.toISOString(),
  };
}

function pendingReviewOutput(asset: ContentAssetWithRelations): {
  workflowRunId: string | null;
  checkpointId: string | null;
  findings: ContentReviewFindingDto[];
  feedback: string | null;
} {
  const workflow = asset.pendingWorkflow;
  if (!workflow) {
    return { workflowRunId: null, checkpointId: null, findings: [], feedback: null };
  }
  const evaluateStep = workflow.steps.find((step) => step.stepKey === "evaluate_content");
  const output = (evaluateStep?.output as { review?: ContentReviewOutput } | null) ?? null;
  return {
    workflowRunId: workflow.id,
    checkpointId: workflow.checkpoints[0]?.id ?? null,
    findings: output?.review ? findingsFromJson(output.review.findings) : [],
    feedback: output?.review?.creator_feedback ?? null,
  };
}

function assetToDto(asset: ContentAssetWithRelations): ContentAssetDto {
  const pending = pendingReviewOutput(asset);
  return {
    id: asset.id,
    campaign_creator_id: asset.campaignCreatorId,
    campaign_id: asset.campaignCreator.campaign.id,
    campaign_name: asset.campaignCreator.campaign.name,
    creator_name: asset.campaignCreator.creator.displayName,
    brief_id: asset.briefId,
    brief_title: asset.brief?.title ?? null,
    title: asset.title,
    status: asset.status,
    content_type: asset.contentType,
    platform: asset.platform,
    caption: asset.caption,
    transcript: asset.transcript,
    url: asset.url,
    planned_publish_at: asset.plannedPublishAt?.toISOString() ?? null,
    published_at: asset.publishedAt?.toISOString() ?? null,
    published_url: asset.publishedUrl,
    approval_evidence_present: Boolean(
      asset.approvedReviewId && asset.approvedCheckpointId && asset.approvedContentHash,
    ),
    content_approved_at: asset.contentApprovedAt?.toISOString() ?? null,
    latest_review: asset.reviews[0] ? reviewToDto(asset.reviews[0]) : null,
    pending_workflow_run_id: pending.workflowRunId,
    pending_checkpoint_id: pending.checkpointId,
    pending_findings: pending.findings,
    pending_feedback: pending.feedback,
    created_at: asset.createdAt.toISOString(),
    updated_at: asset.updatedAt.toISOString(),
  };
}

function workflowResponse(run: WorkflowRun): StartWorkflowResponseDto {
  return {
    workflow_run_id: run.id,
    poll_url: `/api/v1/workflow-runs/${run.id}`,
    events_url: `/api/v1/workflow-runs/${run.id}/events`,
  };
}

export async function listContentAssets(
  ctx: TenantCtx,
  params: ContentAssetListParams,
): Promise<{ items: ContentAssetDto[]; pagination: Pagination }> {
  const rows = await contentRepository.listAssets(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(assetToDto), pagination };
}

export async function getContentAsset(ctx: TenantCtx, id: string): Promise<ContentAssetDto> {
  const asset = await contentRepository.findAsset(ctx, id);
  if (!asset) throw new ApiError("RESOURCE_NOT_FOUND", "内容资产不存在");
  return assetToDto(asset);
}

export async function createContentAsset(
  ctx: TenantCtx,
  input: {
    campaign_creator_id: string;
    brief_id?: string | null;
    title?: string | null;
    content_type?: string | null;
    platform?: string | null;
    caption?: string | null;
    transcript?: string | null;
    url?: string | null;
    planned_publish_at?: string | null;
  },
): Promise<ContentAssetDto> {
  const cc = await contentRepository.findCampaignCreator(ctx, input.campaign_creator_id);
  if (!cc) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 达人不存在");
  const brief = input.brief_id
    ? null
    : await contentRepository.findCurrentBriefForCampaign(ctx, cc.campaignId);
  const asset = await contentRepository.createAsset(ctx, {
    campaignCreatorId: input.campaign_creator_id,
    briefId: input.brief_id ?? brief?.id ?? null,
    title: input.title ?? null,
    contentType: input.content_type ?? null,
    platform: input.platform ?? null,
    caption: input.caption ?? null,
    transcript: input.transcript ?? null,
    url: input.url ?? null,
    plannedPublishAt: input.planned_publish_at ? new Date(input.planned_publish_at) : null,
  });

  if (cc.contentStatus !== "submitted") {
    await campaignRepository.transitionCreatorField(
      ctx,
      cc.id,
      "content_status",
      cc.contentStatus,
      "submitted",
      "内容已提交",
      "user",
    );
  }
  return getContentAsset(ctx, asset.id);
}

export async function transitionContentAssetStatus(
  ctx: TenantCtx,
  id: string,
  to: string,
  reason?: string | null,
): Promise<ContentAssetDto> {
  const asset = await contentRepository.findAsset(ctx, id);
  if (!asset) throw new ApiError("RESOURCE_NOT_FOUND", "内容资产不存在");
  assertTransition(CONTENT_ASSET_STATUS, asset.status, to);
  if (asset.status === "in_review" && ["approved", "revision_requested", "rejected"].includes(to)) {
    throw new ApiError("CONFLICT", "请在审批中心完成内容审核，不能绕过审批门");
  }
  if ((asset.status === "approved" || asset.status === "scheduled") &&
      (to === "scheduled" || to === "published")) {
    const result = await contentRepository.publishWithApprovalEvidence({
      ctx,
      assetId: id,
      fromStatus: asset.status,
      toStatus: to,
      reason: reason ?? null,
    });
    if (result.kind === "invalid_evidence") {
      throw new ApiError(
        "CONTENT_APPROVAL_EVIDENCE_INVALID",
        "当前内容缺少与正文一致的审批证据，请重新发起内容审核",
      );
    }
    if (result.kind !== "published") throw new ApiError("CONFLICT", "内容发布状态已变化");
    return getContentAsset(ctx, id);
  }
  const extra: Record<string, unknown> = {};
  if (to === "published") extra.publishedAt = new Date();
  const transitioned = await contentRepository.transitionAsset(
    ctx,
    id,
    asset.status,
    to,
    reason ?? null,
    extra,
  );
  if (!transitioned) throw new ApiError("CONFLICT", "内容状态已变化，请刷新后重试");
  return getContentAsset(ctx, id);
}

export async function startContentReviewWorkflow(
  ctx: TenantCtx,
  contentAssetId: string,
  instruction?: string | null,
): Promise<StartWorkflowResponseDto> {
  const asset = await contentRepository.findAsset(ctx, contentAssetId);
  if (!asset) throw new ApiError("RESOURCE_NOT_FOUND", "内容资产不存在");
  if (!asset.brief?.currentVersion) {
    throw new ApiError("VALIDATION_FAILED", "Brief 缺失：请先为该 Campaign 生成并批准 Brief");
  }
  const active = await contentRepository.findActiveWorkflow(ctx, contentAssetId);
  if (active) return workflowResponse(active);

  const shouldMarkInReview = asset.status === "submitted" || asset.status === "approved";
  if (!shouldMarkInReview && asset.status !== "in_review") {
    throw new ApiError("CONFLICT", "只有已提交或已过审内容可以发起审核");
  }

  const review = await contentRepository.createQueuedReview(ctx, contentAssetId);
  const run = await startWorkflow(ctx, {
    key: "content_review",
    subjectType: "content_asset",
    subjectId: contentAssetId,
    input: { review_id: review.id, instruction: instruction ?? null },
  });
  if (shouldMarkInReview) {
    const activated = await contentRepository.transitionAsset(
      ctx,
      contentAssetId,
      asset.status,
      "in_review",
      "发起内容审核",
      {
        activeReviewId: review.id,
        approvedReviewId: null,
        approvedCheckpointId: null,
        approvedContentHash: null,
        contentApprovedAt: null,
      },
    );
    if (!activated) throw new ApiError("CONFLICT", "内容状态已变化，请刷新后重试");
  } else {
    const activated = await contentRepository.setActiveReview(ctx, contentAssetId, review.id);
    if (!activated) throw new ApiError("CONFLICT", "内容审核状态已变化，请刷新后重试");
  }
  return workflowResponse(run);
}

export async function listContentReviews(ctx: TenantCtx, contentAssetId: string): Promise<ContentReviewDto[]> {
  const asset = await contentRepository.findAsset(ctx, contentAssetId);
  if (!asset) throw new ApiError("RESOURCE_NOT_FOUND", "内容资产不存在");
  const reviews = await contentRepository.listReviews(ctx, contentAssetId);
  return reviews.map(reviewToDto);
}

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
      findings: output.findings as object,
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

export async function onContentReviewDecided(
  ctx: TenantCtx,
  contentAssetId: string,
  decision: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  if (decision === "approved") return;
  await rejectReviewFromWorkflow(
    ctx,
    contentAssetId,
    null,
    decision === "rejected" ? "内容审核被驳回" : "内容审核要求修改",
  );
}

export async function decideContentCheckpoint(
  ctx: TenantCtx,
  checkpointId: string,
  input: CheckpointDecisionInput,
): Promise<void> {
  const result = await contentRepository.decideContentCheckpoint({
    ctx,
    checkpointId,
    decision: input.decision,
    reason: input.reason?.trim() || null,
    override: input.override,
  });
  if (result.kind === "decided") return;
  if (result.kind === "blocking_findings") {
    throw new ApiError(
      "CONTENT_BLOCKING_FINDINGS",
      "内容命中品牌禁词或 Brief 确定性规则，必须修改后重新审核",
      { finding_ids: result.findingIds },
    );
  }
  if (result.kind === "override_required") {
    throw new ApiError(
      "CONTENT_OVERRIDE_REQUIRED",
      "批准 AI 高风险建议时必须填写至少 10 个字的说明并确认全部风险项",
      { finding_ids: result.findingIds },
    );
  }
  if (result.kind === "not_pending") throw new ApiError("APPROVAL_ALREADY_DECIDED");
  throw new ApiError("CONFLICT", "内容审核证据已变化，请刷新后重新处理");
}
