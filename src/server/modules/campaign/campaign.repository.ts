import "server-only";
import { prisma } from "@/server/db/client";
import type { Campaign, CampaignCreator, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";

export interface CampaignListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  q: string | null;
  status: string | null;
  brandId: string | null;
}

export type CampaignWithBrand = Campaign & {
  brand: { name: string };
  _count: { campaignCreators: number };
};

export const campaignRepository = {
  async list(ctx: TenantCtx, params: CampaignListParams): Promise<CampaignWithBrand[]> {
    return prisma.campaign.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.q ? { name: { contains: params.q, mode: "insensitive" } } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.brandId ? { brandId: params.brandId } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: {
        brand: { select: { name: true } },
        _count: { select: { campaignCreators: { where: { deletedAt: null } } } },
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async findById(ctx: TenantCtx, id: string): Promise<CampaignWithBrand | null> {
    return prisma.campaign.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: {
        brand: { select: { name: true } },
        _count: { select: { campaignCreators: { where: { deletedAt: null } } } },
      },
    });
  },

  async create(
    ctx: TenantCtx,
    data: Omit<Prisma.CampaignUncheckedCreateInput, "tenantId">,
  ): Promise<CampaignWithBrand> {
    return prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null, ownerId: ctx.userId ?? null },
        include: {
          brand: { select: { name: true } },
          _count: { select: { campaignCreators: { where: { deletedAt: null } } } },
        },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "campaign",
          entityId: campaign.id,
          fromValue: null,
          toValue: campaign.status,
          actorId: ctx.userId ?? null,
        },
        tx,
      );
      return campaign;
    });
  },

  async update(
    ctx: TenantCtx,
    id: string,
    data: Prisma.CampaignUncheckedUpdateInput,
  ): Promise<CampaignWithBrand | null> {
    await prisma.campaign.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
    return this.findById(ctx, id);
  },

  async transitionStatus(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    actorType: "user" | "system" | "agent" = "user",
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.campaign.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: toValue, updatedBy: ctx.userId ?? null },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "campaign",
          entityId: id,
          fromValue,
          toValue,
          actorType,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
    });
  },

  async softDelete(ctx: TenantCtx, id: string): Promise<void> {
    await prisma.campaign.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: ctx.userId ?? null },
    });
  },

  async budgetUsed(ctx: TenantCtx, campaignId: string): Promise<number> {
    const agg = await prisma.campaignBudgetItem.aggregate({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      _sum: { spentCents: true, reservedCents: true },
    });
    return (agg._sum.spentCents ?? 0) + (agg._sum.reservedCents ?? 0);
  },

  async openTaskCount(ctx: TenantCtx, campaignId: string): Promise<number> {
    return prisma.campaignTask.count({
      where: {
        tenantId: ctx.orgId,
        campaignId,
        deletedAt: null,
        status: { in: ["todo", "in_progress"] },
      },
    });
  },

  // ---- Campaign 达人 ----

  async listCreators(
    ctx: TenantCtx,
    campaignId: string,
  ): Promise<Array<CampaignCreator & { creator: { displayName: string } }>> {
    return prisma.campaignCreator.findMany({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      include: { creator: { select: { displayName: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  async findCampaignCreator(
    ctx: TenantCtx,
    id: string,
  ): Promise<(CampaignCreator & { creator: { displayName: string } }) | null> {
    return prisma.campaignCreator.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: { creator: { select: { displayName: true } } },
    });
  },

  async addCreators(
    ctx: TenantCtx,
    campaignId: string,
    creatorIds: string[],
    role: string | null,
  ): Promise<number> {
    // 幂等：已存在（未软删）的组合跳过
    const existing = await prisma.campaignCreator.findMany({
      where: { tenantId: ctx.orgId, campaignId, creatorId: { in: creatorIds }, deletedAt: null },
      select: { creatorId: true },
    });
    const existingSet = new Set(existing.map((e) => e.creatorId));
    const toAdd = creatorIds.filter((id) => !existingSet.has(id));
    if (toAdd.length === 0) return 0;
    await prisma.$transaction(async (tx) => {
      for (const creatorId of toAdd) {
        const cc = await tx.campaignCreator.create({
          data: {
            tenantId: ctx.orgId,
            campaignId,
            creatorId,
            role,
            createdBy: ctx.userId ?? null,
          },
        });
        await recordStatusEvent(
          {
            tenantId: ctx.orgId,
            entityType: "campaign_creator",
            entityId: cc.id,
            fromValue: null,
            toValue: cc.status,
            actorId: ctx.userId ?? null,
          },
          tx,
        );
      }
    });
    return toAdd.length;
  },

  async transitionCreatorField(
    ctx: TenantCtx,
    id: string,
    field: "status" | "contract_status" | "payment_status" | "content_status",
    fromValue: string,
    toValue: string,
    reason: string | null,
    actorType: "user" | "system" | "agent" = "user",
  ): Promise<void> {
    const column = {
      status: "status",
      contract_status: "contractStatus",
      payment_status: "paymentStatus",
      content_status: "contentStatus",
    }[field] as "status" | "contractStatus" | "paymentStatus" | "contentStatus";
    await prisma.$transaction(async (tx) => {
      await tx.campaignCreator.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { [column]: toValue, updatedBy: ctx.userId ?? null },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "campaign_creator",
          entityId: id,
          field,
          fromValue,
          toValue,
          actorType,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
    });
  },

  async removeCreator(ctx: TenantCtx, id: string): Promise<void> {
    await prisma.campaignCreator.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: ctx.userId ?? null },
    });
  },

  // ---- 任务 ----

  async listTasks(ctx: TenantCtx, campaignId: string) {
    return prisma.campaignTask.findMany({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  },

  async createTask(ctx: TenantCtx, data: Omit<Prisma.CampaignTaskUncheckedCreateInput, "tenantId">) {
    return prisma.campaignTask.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async updateTask(ctx: TenantCtx, taskId: string, data: Prisma.CampaignTaskUncheckedUpdateInput) {
    await prisma.campaignTask.updateMany({
      where: { id: taskId, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
  },

  async deleteTask(ctx: TenantCtx, taskId: string) {
    await prisma.campaignTask.updateMany({
      where: { id: taskId, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },

  // ---- 预算项 ----

  async listBudgetItems(ctx: TenantCtx, campaignId: string) {
    return prisma.campaignBudgetItem.findMany({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  },

  async createBudgetItem(
    ctx: TenantCtx,
    data: Omit<Prisma.CampaignBudgetItemUncheckedCreateInput, "tenantId">,
  ) {
    return prisma.campaignBudgetItem.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async updateBudgetItem(
    ctx: TenantCtx,
    itemId: string,
    data: Prisma.CampaignBudgetItemUncheckedUpdateInput,
  ) {
    await prisma.campaignBudgetItem.updateMany({
      where: { id: itemId, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
  },

  async deleteBudgetItem(ctx: TenantCtx, itemId: string) {
    await prisma.campaignBudgetItem.updateMany({
      where: { id: itemId, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },
};
