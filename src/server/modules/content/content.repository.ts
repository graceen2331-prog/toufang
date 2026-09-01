import "server-only";
import { prisma } from "@/server/db/client";
import type {
  Brief,
  BriefVersion,
  Campaign,
  CampaignCreator,
  ContentAsset,
  ContentReview,
  Creator,
  HumanCheckpoint,
  Prisma,
  WorkflowRun,
  WorkflowStep,
} from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import { hashContentInput, storedFindingSummary } from "./content-policy";

export interface ContentAssetListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  campaignId: string | null;
}

type CampaignBrief = Brief & { currentVersion: BriefVersion | null };
type CampaignCreatorBrief = CampaignCreator & {
  campaign: Campaign & {
    brand: { name: string; guidelines: Prisma.JsonValue; restrictedTerms: Prisma.JsonValue };
  };
  creator: Pick<Creator, "id" | "displayName">;
};

type PendingWorkflow = WorkflowRun & {
  checkpoints: HumanCheckpoint[];
  steps: WorkflowStep[];
};

export type ContentAssetWithRelations = ContentAsset & {
  campaignCreator: CampaignCreatorBrief;
  brief: CampaignBrief | null;
  reviews: ContentReview[];
  pendingWorkflow: PendingWorkflow | null;
};

export interface ContentReviewContext {
  asset: ContentAssetWithRelations;
  briefVersion: BriefVersion;
}

const assetInclude = {
  reviews: { orderBy: { createdAt: "desc" as const }, take: 5 },
} satisfies Prisma.ContentAssetInclude;

type AssetRow = Prisma.ContentAssetGetPayload<{ include: typeof assetInclude }>;

async function loadBriefs(ctx: TenantCtx, rows: AssetRow[]): Promise<Map<string, CampaignBrief>> {
  const briefIds = [...new Set(rows.map((row) => row.briefId).filter((id): id is string => !!id))];
  if (briefIds.length === 0) return new Map();
  const briefs = await prisma.brief.findMany({
    where: { tenantId: ctx.orgId, id: { in: briefIds }, deletedAt: null },
  });
  const versionIds = briefs.map((brief) => brief.currentVersionId).filter((id): id is string => !!id);
  const versions = versionIds.length
    ? await prisma.briefVersion.findMany({
        where: { tenantId: ctx.orgId, id: { in: versionIds } },
      })
    : [];
  const versionById = new Map(versions.map((version) => [version.id, version]));
  return new Map(
    briefs.map((brief) => [
      brief.id,
      { ...brief, currentVersion: brief.currentVersionId ? (versionById.get(brief.currentVersionId) ?? null) : null },
    ]),
  );
}

async function loadPendingWorkflows(
  ctx: TenantCtx,
  rows: AssetRow[],
): Promise<Map<string, PendingWorkflow>> {
  if (rows.length === 0) return new Map();
  const ids = rows.map((row) => row.id);
  const workflows = await prisma.workflowRun.findMany({
    where: {
      tenantId: ctx.orgId,
      workflowKey: "content_review",
      subjectType: "content_asset",
      subjectId: { in: ids },
      status: { in: ["queued", "running", "waiting_for_human"] },
    },
    include: {
      checkpoints: { where: { status: "pending" }, orderBy: { createdAt: "desc" } },
      steps: { orderBy: { stepOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const result = new Map<string, PendingWorkflow>();
  for (const workflow of workflows) {
    if (workflow.subjectId && !result.has(workflow.subjectId)) result.set(workflow.subjectId, workflow);
  }
  return result;
}

async function hydrateAssets(ctx: TenantCtx, rows: AssetRow[]): Promise<ContentAssetWithRelations[]> {
  if (rows.length === 0) return [];
  const campaignCreatorIds = [...new Set(rows.map((row) => row.campaignCreatorId))];
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { tenantId: ctx.orgId, id: { in: campaignCreatorIds }, deletedAt: null },
    include: {
      campaign: {
        include: {
          brand: { select: { name: true, guidelines: true, restrictedTerms: true } },
        },
      },
      creator: { select: { id: true, displayName: true } },
    },
  });
  const ccById = new Map(campaignCreators.map((cc) => [cc.id, cc]));
  const [briefById, workflowByAssetId] = await Promise.all([
    loadBriefs(ctx, rows),
    loadPendingWorkflows(ctx, rows),
  ]);
  return rows.map((row) => {
    const campaignCreator = ccById.get(row.campaignCreatorId);
    if (!campaignCreator) {
      throw new Error(`content_asset ${row.id} 缺少 campaign_creator ${row.campaignCreatorId}`);
    }
    return {
      ...row,
      campaignCreator,
      brief: row.briefId ? (briefById.get(row.briefId) ?? null) : null,
      pendingWorkflow: workflowByAssetId.get(row.id) ?? null,
    };
  });
}

export const contentRepository = {
  async listAssets(ctx: TenantCtx, params: ContentAssetListParams): Promise<ContentAssetWithRelations[]> {
    let campaignCreatorIds: string[] | null = null;
    if (params.campaignId) {
      const campaignCreators = await prisma.campaignCreator.findMany({
        where: { tenantId: ctx.orgId, campaignId: params.campaignId, deletedAt: null },
        select: { id: true },
      });
      campaignCreatorIds = campaignCreators.map((cc) => cc.id);
      if (campaignCreatorIds.length === 0) return [];
    }

    const rows = await prisma.contentAsset.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.status ? { status: params.status } : {}),
        ...(campaignCreatorIds ? { campaignCreatorId: { in: campaignCreatorIds } } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: assetInclude,
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
    return hydrateAssets(ctx, rows);
  },

  async findAsset(ctx: TenantCtx, id: string): Promise<ContentAssetWithRelations | null> {
    const row = await prisma.contentAsset.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: assetInclude,
    });
    if (!row) return null;
    return (await hydrateAssets(ctx, [row]))[0] ?? null;
  },

  async findCampaignCreator(ctx: TenantCtx, id: string): Promise<CampaignCreatorBrief | null> {
    return prisma.campaignCreator.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: {
        campaign: {
          include: { brand: { select: { name: true, guidelines: true, restrictedTerms: true } } },
        },
        creator: { select: { id: true, displayName: true } },
      },
    });
  },

  async findCurrentBriefForCampaign(ctx: TenantCtx, campaignId: string): Promise<CampaignBrief | null> {
    const brief = await prisma.brief.findFirst({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null, status: { in: ["approved", "locked"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (!brief) return null;
    const currentVersion = brief.currentVersionId
      ? await prisma.briefVersion.findFirst({
          where: { tenantId: ctx.orgId, id: brief.currentVersionId },
        })
      : null;
    return { ...brief, currentVersion };
  },

  async createAsset(
    ctx: TenantCtx,
    data: Omit<Prisma.ContentAssetUncheckedCreateInput, "tenantId">,
  ): Promise<ContentAsset> {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.contentAsset.create({
        data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "content_asset",
          entityId: asset.id,
          fromValue: null,
          toValue: asset.status,
          actorId: ctx.userId ?? null,
        },
        tx,
      );
      return asset;
    });
  },

  async transitionAsset(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.ContentAssetUncheckedUpdateInput = {},
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.contentAsset.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null, status: fromValue },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      if (updated.count !== 1) return false;
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "content_asset",
          entityId: id,
          fromValue,
          toValue,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
      return true;
    });
  },

  async setActiveReview(ctx: TenantCtx, id: string, reviewId: string): Promise<boolean> {
    const updated = await prisma.contentAsset.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null, status: "in_review" },
      data: {
        activeReviewId: reviewId,
        approvedReviewId: null,
        approvedCheckpointId: null,
        approvedContentHash: null,
        contentApprovedAt: null,
        updatedBy: ctx.userId ?? null,
      },
    });
    return updated.count === 1;
  },

  async createQueuedReview(ctx: TenantCtx, contentAssetId: string): Promise<ContentReview> {
    return prisma.$transaction(async (tx) => {
      const review = await tx.contentReview.create({
        data: {
          tenantId: ctx.orgId,
          contentAssetId,
          status: "queued",
          createdBy: ctx.userId ?? null,
        },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "content_review",
          entityId: review.id,
          fromValue: null,
          toValue: "queued",
          actorId: ctx.userId ?? null,
        },
        tx,
      );
      return review;
    });
  },

  async findReview(ctx: TenantCtx, id: string): Promise<ContentReview | null> {
    return prisma.contentReview.findFirst({ where: { id, tenantId: ctx.orgId } });
  },

  async transitionReview(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.ContentReviewUncheckedUpdateInput = {},
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.contentReview.updateMany({
        where: { id, tenantId: ctx.orgId, status: fromValue },
        data: { status: toValue, ...extra },
      });
      if (updated.count !== 1) return false;
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "content_review",
          entityId: id,
          fromValue,
          toValue,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
      return true;
    });
  },

  async recordReviewEvaluation(
    ctx: TenantCtx,
    reviewId: string,
    input: {
      decision: string;
      riskLevel: string;
      findings: object;
      feedback: string;
      inputHash: string;
      ruleSetVersion: string;
      deterministicSummary: object;
      normalizationNotes: string[];
      agentRunId: string;
      promptKey: string | null;
      promptVersion: string | null;
      model: string | null;
    },
  ): Promise<boolean> {
    const updated = await prisma.contentReview.updateMany({
      where: { id: reviewId, tenantId: ctx.orgId, status: "reviewing" },
      data: {
        decision: input.decision,
        riskLevel: input.riskLevel,
        findings: input.findings as Prisma.InputJsonValue,
        feedback: input.feedback,
        inputHash: input.inputHash,
        ruleSetVersion: input.ruleSetVersion,
        deterministicSummary: input.deterministicSummary as Prisma.InputJsonValue,
        normalizationNotes: input.normalizationNotes,
        aiGenerated: true,
        agentRunId: input.agentRunId,
        promptKey: input.promptKey,
        promptVersion: input.promptVersion,
        model: input.model,
      },
    });
    return updated.count === 1;
  },

  async decideContentCheckpoint(input: {
    ctx: TenantCtx;
    checkpointId: string;
    decision: "approved" | "rejected" | "changes_requested";
    reason: string | null;
    override?: {
      enabled: true;
      category: "false_positive" | "evidence_verified" | "brand_authorized" | "other";
      acknowledged_finding_ids: string[];
    };
  }) {
    return prisma.$transaction(async (tx) => {
      const checkpoint = await tx.humanCheckpoint.findFirst({
        where: {
          id: input.checkpointId,
          tenantId: input.ctx.orgId,
          type: "content",
          entityType: "content_asset",
          status: "pending",
        },
      });
      if (!checkpoint?.entityId) return { kind: "not_pending" as const };

      const asset = await tx.contentAsset.findFirst({
        where: {
          id: checkpoint.entityId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: "in_review",
        },
      });
      if (!asset?.activeReviewId) return { kind: "stale_review" as const };
      const review = await tx.contentReview.findFirst({
        where: {
          id: asset.activeReviewId,
          tenantId: input.ctx.orgId,
          contentAssetId: asset.id,
          status: "reviewing",
        },
      });
      if (!review?.inputHash) return { kind: "evidence_missing" as const };

      const payload =
        checkpoint.payload && typeof checkpoint.payload === "object" && !Array.isArray(checkpoint.payload)
          ? (checkpoint.payload as Record<string, unknown>)
          : {};
      if (payload.review_id !== review.id || payload.input_hash !== review.inputHash) {
        return { kind: "evidence_mismatch" as const };
      }
      const currentHash = hashContentInput({
        platform: asset.platform,
        caption: asset.caption,
        transcript: asset.transcript,
        url: asset.url,
      });
      if (currentHash !== review.inputHash) return { kind: "content_changed" as const };

      const findingSummary = storedFindingSummary(review.findings);
      if (input.decision === "approved" && findingSummary.blockingIds.length > 0) {
        return { kind: "blocking_findings" as const, findingIds: findingSummary.blockingIds };
      }
      if (input.decision === "approved" && findingSummary.advisoryHighIds.length > 0) {
        const acknowledged = new Set(input.override?.acknowledged_finding_ids ?? []);
        const allAcknowledged = findingSummary.advisoryHighIds.every((id) => acknowledged.has(id));
        if (!input.override?.enabled || !allAcknowledged || (input.reason?.trim().length ?? 0) < 10) {
          return {
            kind: "override_required" as const,
            findingIds: findingSummary.advisoryHighIds,
          };
        }
      }

      const decisionMetadata =
        input.decision === "approved" && input.override
          ? {
              override: true,
              category: input.override.category,
              acknowledged_finding_ids: input.override.acknowledged_finding_ids,
              review_id: review.id,
              input_hash: review.inputHash,
              rule_set_version: review.ruleSetVersion,
            }
          : {
              override: false,
              review_id: review.id,
              input_hash: review.inputHash,
              rule_set_version: review.ruleSetVersion,
            };
      const now = new Date();
      const checkpointUpdated = await tx.humanCheckpoint.updateMany({
        where: { id: checkpoint.id, tenantId: input.ctx.orgId, status: "pending" },
        data: {
          status: input.decision,
          decidedBy: input.ctx.userId ?? null,
          decidedAt: now,
          decisionReason: input.reason,
          decisionMetadata,
        },
      });
      if (checkpointUpdated.count !== 1) return { kind: "not_pending" as const };

      const reviewUpdated = await tx.contentReview.updateMany({
        where: { id: review.id, tenantId: input.ctx.orgId, status: "reviewing" },
        data: {
          status: "completed",
          finalDecision: input.decision,
          reviewerId: input.ctx.userId ?? null,
          checkpointId: checkpoint.id,
          overrideMetadata: decisionMetadata,
          completedAt: now,
        },
      });
      if (reviewUpdated.count !== 1) throw new Error("内容审核状态已变化");

      const assetTarget =
        input.decision === "approved"
          ? "approved"
          : input.decision === "rejected"
            ? "rejected"
            : "revision_requested";
      const assetUpdated = await tx.contentAsset.updateMany({
        where: {
          id: asset.id,
          tenantId: input.ctx.orgId,
          status: "in_review",
          activeReviewId: review.id,
        },
        data: {
          status: assetTarget,
          activeReviewId: null,
          approvedReviewId: input.decision === "approved" ? review.id : null,
          approvedCheckpointId: input.decision === "approved" ? checkpoint.id : null,
          approvedContentHash: input.decision === "approved" ? review.inputHash : null,
          contentApprovedAt: input.decision === "approved" ? now : null,
          updatedBy: input.ctx.userId ?? null,
        },
      });
      if (assetUpdated.count !== 1) throw new Error("内容资产审核状态已变化");

      const campaignCreator = await tx.campaignCreator.findFirst({
        where: { id: asset.campaignCreatorId, tenantId: input.ctx.orgId, deletedAt: null },
        select: { contentStatus: true },
      });
      if (!campaignCreator) throw new Error("Campaign 达人不存在");
      const creatorTarget = input.decision === "approved" ? "approved" : "submitted";
      if (campaignCreator.contentStatus !== creatorTarget) {
        const creatorUpdated = await tx.campaignCreator.updateMany({
          where: {
            id: asset.campaignCreatorId,
            tenantId: input.ctx.orgId,
            deletedAt: null,
            contentStatus: campaignCreator.contentStatus,
          },
          data: { contentStatus: creatorTarget, updatedBy: input.ctx.userId ?? null },
        });
        if (creatorUpdated.count !== 1) throw new Error("Campaign 达人内容状态已变化");
        await recordStatusEvent(
          {
            tenantId: input.ctx.orgId,
            entityType: "campaign_creator",
            entityId: asset.campaignCreatorId,
            field: "content_status",
            fromValue: campaignCreator.contentStatus,
            toValue: creatorTarget,
            actorId: input.ctx.userId ?? null,
            reason: "内容人工审核决定",
            metadata: decisionMetadata,
          },
          tx,
        );
      }

      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: "human_checkpoint",
          entityId: checkpoint.id,
          fromValue: "pending",
          toValue: input.decision,
          actorId: input.ctx.userId ?? null,
          reason: input.reason,
          metadata: decisionMetadata,
        },
        tx,
      );
      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: "content_review",
          entityId: review.id,
          fromValue: "reviewing",
          toValue: "completed",
          actorId: input.ctx.userId ?? null,
          reason: "内容人工审核决定",
          metadata: decisionMetadata,
        },
        tx,
      );
      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: "content_asset",
          entityId: asset.id,
          fromValue: "in_review",
          toValue: assetTarget,
          actorId: input.ctx.userId ?? null,
          reason: input.reason ?? "内容人工审核决定",
          metadata: decisionMetadata,
        },
        tx,
      );
      return { kind: "decided" as const };
    });
  },

  async publishWithApprovalEvidence(input: {
    ctx: TenantCtx;
    assetId: string;
    fromStatus: "approved" | "scheduled";
    toStatus: "scheduled" | "published";
    reason: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.contentAsset.findFirst({
        where: {
          id: input.assetId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: input.fromStatus,
        },
      });
      if (!asset) return { kind: "not_found_or_conflict" as const };
      if (!asset.approvedReviewId || !asset.approvedCheckpointId || !asset.approvedContentHash) {
        return { kind: "invalid_evidence" as const };
      }
      const [review, checkpoint, campaignCreator] = await Promise.all([
        tx.contentReview.findFirst({
          where: {
            id: asset.approvedReviewId,
            tenantId: input.ctx.orgId,
            contentAssetId: asset.id,
            status: "completed",
            finalDecision: "approved",
            inputHash: asset.approvedContentHash,
            checkpointId: asset.approvedCheckpointId,
          },
        }),
        tx.humanCheckpoint.findFirst({
          where: {
            id: asset.approvedCheckpointId,
            tenantId: input.ctx.orgId,
            type: "content",
            entityType: "content_asset",
            entityId: asset.id,
            status: "approved",
            decidedBy: { not: null },
            decidedAt: { not: null },
          },
        }),
        tx.campaignCreator.findFirst({
          where: { id: asset.campaignCreatorId, tenantId: input.ctx.orgId, deletedAt: null },
          select: { contentStatus: true },
        }),
      ]);
      if (!review || !checkpoint || !campaignCreator) return { kind: "invalid_evidence" as const };
      const currentHash = hashContentInput({
        platform: asset.platform,
        caption: asset.caption,
        transcript: asset.transcript,
        url: asset.url,
      });
      if (currentHash !== asset.approvedContentHash || campaignCreator.contentStatus !== "approved") {
        return { kind: "invalid_evidence" as const };
      }

      const updated = await tx.contentAsset.updateMany({
        where: {
          id: asset.id,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: input.fromStatus,
          approvedContentHash: asset.approvedContentHash,
        },
        data: {
          status: input.toStatus,
          ...(input.toStatus === "published" ? { publishedAt: new Date() } : {}),
          updatedBy: input.ctx.userId ?? null,
        },
      });
      if (updated.count !== 1) return { kind: "not_found_or_conflict" as const };
      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: "content_asset",
          entityId: asset.id,
          fromValue: input.fromStatus,
          toValue: input.toStatus,
          actorId: input.ctx.userId ?? null,
          reason: input.reason,
          metadata: {
            approved_review_id: review.id,
            approved_checkpoint_id: checkpoint.id,
            approved_content_hash: asset.approvedContentHash,
          },
        },
        tx,
      );
      if (input.toStatus === "published") {
        const creatorUpdated = await tx.campaignCreator.updateMany({
          where: {
            id: asset.campaignCreatorId,
            tenantId: input.ctx.orgId,
            deletedAt: null,
            contentStatus: "approved",
          },
          data: { contentStatus: "published", updatedBy: input.ctx.userId ?? null },
        });
        if (creatorUpdated.count !== 1) throw new Error("Campaign 达人内容状态已变化");
        await recordStatusEvent(
          {
            tenantId: input.ctx.orgId,
            entityType: "campaign_creator",
            entityId: asset.campaignCreatorId,
            field: "content_status",
            fromValue: "approved",
            toValue: "published",
            actorId: input.ctx.userId ?? null,
            reason: input.reason,
          },
          tx,
        );
      }
      return { kind: "published" as const };
    });
  },

  async listReviews(ctx: TenantCtx, contentAssetId: string): Promise<ContentReview[]> {
    return prisma.contentReview.findMany({
      where: { tenantId: ctx.orgId, contentAssetId },
      orderBy: { createdAt: "desc" },
    });
  },

  async getAgentRunTrace(agentRunId: string) {
    return prisma.agentRun.findUnique({
      where: { id: agentRunId },
      select: { promptKey: true, promptVersion: true, model: true },
    });
  },

  async findActiveWorkflow(ctx: TenantCtx, contentAssetId: string): Promise<WorkflowRun | null> {
    return prisma.workflowRun.findFirst({
      where: {
        tenantId: ctx.orgId,
        workflowKey: "content_review",
        subjectType: "content_asset",
        subjectId: contentAssetId,
        status: { in: ["queued", "running", "waiting_for_human"] },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getReviewContext(ctx: TenantCtx, contentAssetId: string): Promise<ContentReviewContext | null> {
    const asset = await this.findAsset(ctx, contentAssetId);
    if (!asset || !asset.brief?.currentVersion) return null;
    return { asset, briefVersion: asset.brief.currentVersion };
  },
};
