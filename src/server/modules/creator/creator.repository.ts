import "server-only";
import { prisma } from "@/server/db/client";
import type { Creator, CreatorPlatformAccount, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";

export interface CreatorListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  q: string | null;
  platform: string | null;
  relationshipStatus: string | null;
  riskLevel: string | null;
  country: string | null;
  tag: string | null;
  minFollowers: number | null;
}

export type CreatorWithAccounts = Creator & { platformAccounts: CreatorPlatformAccount[] };

export const creatorRepository = {
  async list(ctx: TenantCtx, params: CreatorListParams): Promise<CreatorWithAccounts[]> {
    return prisma.creator.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.q
          ? {
              OR: [
                { displayName: { contains: params.q, mode: "insensitive" } },
                { bio: { contains: params.q, mode: "insensitive" } },
                { profileSummary: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(params.relationshipStatus ? { relationshipStatus: params.relationshipStatus } : {}),
        ...(params.riskLevel ? { riskLevel: params.riskLevel } : {}),
        ...(params.country ? { country: params.country } : {}),
        ...(params.tag ? { tags: { has: params.tag } } : {}),
        ...(params.platform
          ? {
              platformAccounts: {
                some: {
                  platform: params.platform,
                  deletedAt: null,
                  ...(params.minFollowers ? { followers: { gte: params.minFollowers } } : {}),
                },
              },
            }
          : params.minFollowers
            ? {
                platformAccounts: {
                  some: { followers: { gte: params.minFollowers }, deletedAt: null },
                },
              }
            : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: { platformAccounts: { where: { deletedAt: null } } },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async findById(ctx: TenantCtx, id: string): Promise<CreatorWithAccounts | null> {
    return prisma.creator.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: { platformAccounts: { where: { deletedAt: null } } },
    });
  },

  async create(
    ctx: TenantCtx,
    data: Omit<Prisma.CreatorUncheckedCreateInput, "tenantId">,
  ): Promise<CreatorWithAccounts> {
    return prisma.creator.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
      include: { platformAccounts: { where: { deletedAt: null } } },
    });
  },

  async update(
    ctx: TenantCtx,
    id: string,
    data: Prisma.CreatorUncheckedUpdateInput,
  ): Promise<CreatorWithAccounts | null> {
    await prisma.creator.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
    return this.findById(ctx, id);
  },

  async softDelete(ctx: TenantCtx, id: string): Promise<void> {
    await prisma.creator.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: ctx.userId ?? null },
    });
  },

  /** 状态转移（事务内更新 + 写状态事件） */
  async transitionStatus(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.creator.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { relationshipStatus: toValue, updatedBy: ctx.userId ?? null },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "creator",
          entityId: id,
          field: "relationship_status",
          fromValue,
          toValue,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
    });
  },

  async latestSnapshot(ctx: TenantCtx, creatorId: string) {
    return prisma.creatorMetricSnapshot.findFirst({
      where: { tenantId: ctx.orgId, creatorId },
      orderBy: { capturedAt: "desc" },
    });
  },

  // ---- 平台账号 ----
  async findAccount(ctx: TenantCtx, creatorId: string, accountId: string) {
    return prisma.creatorPlatformAccount.findFirst({
      where: { id: accountId, creatorId, tenantId: ctx.orgId, deletedAt: null },
    });
  },

  async findAccountByHandle(ctx: TenantCtx, platform: string, handle: string) {
    return prisma.creatorPlatformAccount.findFirst({
      where: { tenantId: ctx.orgId, platform, handle, deletedAt: null },
    });
  },

  async createAccount(
    ctx: TenantCtx,
    data: Omit<Prisma.CreatorPlatformAccountUncheckedCreateInput, "tenantId">,
  ): Promise<CreatorPlatformAccount> {
    return prisma.creatorPlatformAccount.create({ data: { ...data, tenantId: ctx.orgId } });
  },

  async updateAccount(
    ctx: TenantCtx,
    accountId: string,
    data: Prisma.CreatorPlatformAccountUncheckedUpdateInput,
  ): Promise<void> {
    await prisma.creatorPlatformAccount.updateMany({
      where: { id: accountId, tenantId: ctx.orgId, deletedAt: null },
      data,
    });
  },

  async deleteAccount(ctx: TenantCtx, accountId: string): Promise<void> {
    await prisma.creatorPlatformAccount.updateMany({
      where: { id: accountId, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },

  // ---- 笔记 ----
  async listNotes(ctx: TenantCtx, creatorId: string) {
    return prisma.creatorNote.findMany({
      where: { tenantId: ctx.orgId, creatorId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async createNote(ctx: TenantCtx, creatorId: string, content: string) {
    return prisma.creatorNote.create({
      data: { tenantId: ctx.orgId, creatorId, content, createdBy: ctx.userId ?? null },
    });
  },

  async deleteNote(ctx: TenantCtx, noteId: string): Promise<void> {
    await prisma.creatorNote.updateMany({
      where: { id: noteId, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },
};
