import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface NotificationListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  unreadOnly: boolean;
  type: string | null;
}

export const notificationRepository = {
  async list(ctx: TenantCtx, params: NotificationListParams) {
    return prisma.notification.findMany({
      where: {
        tenantId: ctx.orgId,
        userId: ctx.userId ?? "",
        ...(params.unreadOnly ? { readAt: null } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async countUnread(ctx: TenantCtx): Promise<number> {
    return prisma.notification.count({
      where: { tenantId: ctx.orgId, userId: ctx.userId ?? "", readAt: null },
    });
  },

  async markRead(ctx: TenantCtx, ids: string[]): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { tenantId: ctx.orgId, userId: ctx.userId ?? "", id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  },

  async markAllRead(ctx: TenantCtx): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { tenantId: ctx.orgId, userId: ctx.userId ?? "", readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  },

  async createForUser(
    ctx: { orgId: string },
    userId: string,
    data: Omit<Prisma.NotificationUncheckedCreateInput, "tenantId" | "userId">,
  ) {
    return prisma.notification.create({ data: { ...data, tenantId: ctx.orgId, userId } });
  },

  async findActiveUsersByRole(tenantId: string, roleKey: string): Promise<string[]> {
    const memberships = await prisma.membership.findMany({
      where: { tenantId, status: "active", deletedAt: null, role: { key: roleKey } },
      select: { userId: true },
    });
    return memberships.map((membership) => membership.userId);
  },
};
