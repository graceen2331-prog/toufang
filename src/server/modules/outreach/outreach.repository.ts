import "server-only";
import { prisma } from "@/server/db/client";
import type { CampaignCreator, OutreachThread, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";

export interface ThreadListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  campaignId: string | null;
}

const threadInclude = {
  _count: { select: { messages: { where: { deletedAt: null } } } },
} satisfies Prisma.OutreachThreadInclude;

export type ThreadWithRelations = OutreachThread & {
  campaignCreator: CampaignCreator & {
    campaign: { id: string; name: string; budgetTotalCents: number };
    creator: { id: string; displayName: string };
  };
  _count: { messages: number };
};

type ThreadRow = Prisma.OutreachThreadGetPayload<{ include: typeof threadInclude }>;

async function hydrateThreads(ctx: TenantCtx, rows: ThreadRow[]): Promise<ThreadWithRelations[]> {
  if (rows.length === 0) return [];
  const campaignCreatorIds = [...new Set(rows.map((row) => row.campaignCreatorId))];
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { id: { in: campaignCreatorIds }, tenantId: ctx.orgId, deletedAt: null },
    include: {
      campaign: { select: { id: true, name: true, budgetTotalCents: true } },
      creator: { select: { id: true, displayName: true } },
    },
  });
  const byId = new Map(campaignCreators.map((cc) => [cc.id, cc]));
  return rows.map((row) => {
    const campaignCreator = byId.get(row.campaignCreatorId);
    if (!campaignCreator) {
      throw new Error(`outreach thread ${row.id} 缺少 campaign_creator ${row.campaignCreatorId}`);
    }
    return { ...row, campaignCreator };
  });
}

export const outreachRepository = {
  async listThreads(ctx: TenantCtx, params: ThreadListParams): Promise<ThreadWithRelations[]> {
    let campaignCreatorIds: string[] | null = null;
    if (params.campaignId) {
      const campaignCreators = await prisma.campaignCreator.findMany({
        where: { tenantId: ctx.orgId, campaignId: params.campaignId, deletedAt: null },
        select: { id: true },
      });
      campaignCreatorIds = campaignCreators.map((cc) => cc.id);
      if (campaignCreatorIds.length === 0) return [];
    }

    const rows = await prisma.outreachThread.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.status ? { status: params.status } : {}),
        ...(campaignCreatorIds ? { campaignCreatorId: { in: campaignCreatorIds } } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: threadInclude,
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
    return hydrateThreads(ctx, rows);
  },

  async findThread(ctx: TenantCtx, id: string): Promise<ThreadWithRelations | null> {
    const row = await prisma.outreachThread.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: threadInclude,
    });
    if (!row) return null;
    return (await hydrateThreads(ctx, [row]))[0] ?? null;
  },

  async findThreadByCampaignCreator(ctx: TenantCtx, campaignCreatorId: string) {
    return prisma.outreachThread.findFirst({
      where: { tenantId: ctx.orgId, campaignCreatorId, deletedAt: null },
    });
  },

  async listThreadsByCampaignCreatorIds(ctx: TenantCtx, campaignCreatorIds: string[]) {
    if (campaignCreatorIds.length === 0) return [];
    return prisma.outreachThread.findMany({
      where: {
        tenantId: ctx.orgId,
        campaignCreatorId: { in: campaignCreatorIds },
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  },

  async createThread(ctx: TenantCtx, data: Omit<Prisma.OutreachThreadUncheckedCreateInput, "tenantId">) {
    return prisma.outreachThread.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async updateThreadStatus(ctx: TenantCtx, id: string, status: string) {
    await prisma.outreachThread.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { status },
    });
  },

  async touchThread(ctx: TenantCtx, id: string) {
    await prisma.outreachThread.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { lastMessageAt: new Date() },
    });
  },

  // ---- 消息 ----

  async listMessages(ctx: TenantCtx, threadId: string) {
    return prisma.outreachMessage.findMany({
      where: { tenantId: ctx.orgId, threadId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  },

  async findMessage(ctx: TenantCtx, id: string) {
    return prisma.outreachMessage.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
    });
  },

  async hasPendingApproval(ctx: TenantCtx, threadIds: string[]): Promise<Set<string>> {
    if (threadIds.length === 0) return new Set();
    const rows = await prisma.outreachMessage.findMany({
      where: {
        tenantId: ctx.orgId,
        threadId: { in: threadIds },
        deletedAt: null,
        status: "pending_approval",
      },
      select: { threadId: true },
    });
    return new Set(rows.map((r) => r.threadId));
  },

  async createMessage(ctx: TenantCtx, data: Omit<Prisma.OutreachMessageUncheckedCreateInput, "tenantId">) {
    return prisma.outreachMessage.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async updateMessage(ctx: TenantCtx, id: string, data: Prisma.OutreachMessageUncheckedUpdateInput) {
    await prisma.outreachMessage.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
  },

  /** 消息状态转移（事务：更新 + 状态事件） */
  async transitionMessage(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.OutreachMessageUncheckedUpdateInput = {},
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.outreachMessage.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "outreach_message",
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

  // ---- 上下文查询（供 AI 起草/谈判分析用） ----

  async getCampaignWithBrand(ctx: TenantCtx, campaignId: string) {
    return prisma.campaign.findFirst({
      where: { id: campaignId, tenantId: ctx.orgId, deletedAt: null },
      include: { brand: true },
    });
  },

  async getCreatorWithAccounts(ctx: TenantCtx, creatorId: string) {
    return prisma.creator.findFirst({
      where: { id: creatorId, tenantId: ctx.orgId, deletedAt: null },
      include: { platformAccounts: { where: { deletedAt: null } } },
    });
  },

  async getCurrentBriefText(ctx: TenantCtx, campaignId: string): Promise<string | null> {
    const brief = await prisma.brief.findFirst({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
    });
    if (!brief?.currentVersionId) return null;
    const version = await prisma.briefVersion.findFirst({
      where: { id: brief.currentVersionId, tenantId: ctx.orgId },
    });
    return version?.plainText ?? null;
  },

  async getAgentRunTrace(agentRunId: string) {
    return prisma.agentRun.findUnique({
      where: { id: agentRunId },
      select: { promptKey: true, promptVersion: true, model: true },
    });
  },

  async updateCampaignCreatorTerms(
    ctx: TenantCtx,
    campaignCreatorId: string,
    agreedPriceCents: number,
    deliverables: string[],
  ) {
    await prisma.campaignCreator.updateMany({
      where: { id: campaignCreatorId, tenantId: ctx.orgId, deletedAt: null },
      data: { agreedPriceCents, deliverables },
    });
  },

  // ---- 谈判 ----

  async listNegotiations(ctx: TenantCtx, threadId: string) {
    return prisma.negotiationRecord.findMany({
      where: { tenantId: ctx.orgId, threadId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async findNegotiation(ctx: TenantCtx, id: string) {
    return prisma.negotiationRecord.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
    });
  },

  async createNegotiation(
    ctx: TenantCtx,
    data: Omit<Prisma.NegotiationRecordUncheckedCreateInput, "tenantId">,
  ) {
    return prisma.negotiationRecord.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async updateNegotiation(
    ctx: TenantCtx,
    id: string,
    data: Prisma.NegotiationRecordUncheckedUpdateInput,
  ) {
    await prisma.negotiationRecord.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
  },
};
