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
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.contentAsset.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
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
    });
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
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.contentReview.updateMany({
        where: { id, tenantId: ctx.orgId },
        data: { status: toValue, ...extra },
      });
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
