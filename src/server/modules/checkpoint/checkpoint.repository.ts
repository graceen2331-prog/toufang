import "server-only";
import { prisma } from "@/server/db/client";
import type { HumanCheckpoint, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface CheckpointListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  type: string | null;
  campaignId?: string | null;
}

export interface CampaignCheckpointRefs {
  campaignCreatorIds: string[];
  contentAssetIds: string[];
  contractIds: string[];
  outreachMessageIds: string[];
  paymentRecordIds: string[];
  reportIds: string[];
}

function idsCondition(ids: string[]): { in: string[] } | undefined {
  return ids.length > 0 ? { in: ids } : undefined;
}

export function buildCampaignCheckpointWhere(
  campaignId: string,
  refs: CampaignCheckpointRefs,
): Prisma.HumanCheckpointWhereInput {
  const workflowSubjects: Prisma.WorkflowRunWhereInput[] = [
    { subjectType: "campaign", subjectId: campaignId },
  ];
  const ors: Prisma.HumanCheckpointWhereInput[] = [
    { entityType: "campaign", entityId: campaignId },
  ];

  const campaignCreatorIds = idsCondition(refs.campaignCreatorIds);
  if (campaignCreatorIds) {
    ors.push({ entityType: "campaign_creator", entityId: campaignCreatorIds });
    workflowSubjects.push({ subjectType: "campaign_creator", subjectId: campaignCreatorIds });
  }

  const outreachMessageIds = idsCondition(refs.outreachMessageIds);
  if (outreachMessageIds) {
    ors.push({ entityType: "outreach_message", entityId: outreachMessageIds });
  }

  const contractIds = idsCondition(refs.contractIds);
  if (contractIds) ors.push({ entityType: "contract", entityId: contractIds });

  const paymentRecordIds = idsCondition(refs.paymentRecordIds);
  if (paymentRecordIds) ors.push({ entityType: "payment_record", entityId: paymentRecordIds });

  const contentAssetIds = idsCondition(refs.contentAssetIds);
  if (contentAssetIds) {
    ors.push({ entityType: "content_asset", entityId: contentAssetIds });
    workflowSubjects.push({ subjectType: "content_asset", subjectId: contentAssetIds });
  }

  const reportIds = idsCondition(refs.reportIds);
  if (reportIds) ors.push({ entityType: "report", entityId: reportIds });

  ors.push({
    workflowRun: {
      is: {
        OR: workflowSubjects,
      },
    },
  });

  return { OR: ors };
}

async function collectCampaignCheckpointRefs(
  ctx: TenantCtx,
  campaignId: string,
): Promise<CampaignCheckpointRefs> {
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
    select: { id: true },
  });
  const campaignCreatorIds = campaignCreators.map((item) => item.id);

  const [threads, contentAssets, contracts, reports] = await Promise.all([
    campaignCreatorIds.length
      ? prisma.outreachThread.findMany({
          where: {
            tenantId: ctx.orgId,
            campaignCreatorId: { in: campaignCreatorIds },
            deletedAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    campaignCreatorIds.length
      ? prisma.contentAsset.findMany({
          where: {
            tenantId: ctx.orgId,
            campaignCreatorId: { in: campaignCreatorIds },
            deletedAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    campaignCreatorIds.length
      ? prisma.contract.findMany({
          where: {
            tenantId: ctx.orgId,
            campaignCreatorId: { in: campaignCreatorIds },
            deletedAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.report.findMany({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const threadIds = threads.map((item) => item.id);
  const contractIds = contracts.map((item) => item.id);
  const [messages, payments] = await Promise.all([
    threadIds.length
      ? prisma.outreachMessage.findMany({
          where: { tenantId: ctx.orgId, threadId: { in: threadIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    contractIds.length
      ? prisma.paymentRecord.findMany({
          where: { tenantId: ctx.orgId, contractId: { in: contractIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    campaignCreatorIds,
    contentAssetIds: contentAssets.map((item) => item.id),
    contractIds,
    outreachMessageIds: messages.map((item) => item.id),
    paymentRecordIds: payments.map((item) => item.id),
    reportIds: reports.map((item) => item.id),
  };
}

export const checkpointRepository = {
  async list(ctx: TenantCtx, params: CheckpointListParams): Promise<HumanCheckpoint[]> {
    const campaignWhere = params.campaignId
      ? buildCampaignCheckpointWhere(
          params.campaignId,
          await collectCampaignCheckpointRefs(ctx, params.campaignId),
        )
      : {};

    return prisma.humanCheckpoint.findMany({
      where: {
        tenantId: ctx.orgId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
        ...campaignWhere,
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async countPending(ctx: TenantCtx): Promise<number> {
    return prisma.humanCheckpoint.count({ where: { tenantId: ctx.orgId, status: "pending" } });
  },

  async findById(ctx: TenantCtx, id: string): Promise<HumanCheckpoint | null> {
    return prisma.humanCheckpoint.findFirst({ where: { id, tenantId: ctx.orgId } });
  },

  async create(
    ctx: TenantCtx,
    data: Omit<Prisma.HumanCheckpointUncheckedCreateInput, "tenantId">,
  ): Promise<HumanCheckpoint> {
    return prisma.humanCheckpoint.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  /** 原子决策：仅 pending 可被决策（乐观并发保护） */
  async decide(
    ctx: TenantCtx,
    id: string,
    status: "approved" | "rejected" | "changes_requested",
    reason: string | null,
  ): Promise<boolean> {
    const result = await prisma.humanCheckpoint.updateMany({
      where: { id, tenantId: ctx.orgId, status: "pending" },
      data: {
        status,
        decidedBy: ctx.userId ?? null,
        decidedAt: new Date(),
        decisionReason: reason,
      },
    });
    return result.count > 0;
  },
};
