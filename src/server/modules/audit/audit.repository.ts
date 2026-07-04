import "server-only";
import { prisma } from "@/server/db/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface AuditLogListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  actorId: string | null;
  entityType: string | null;
  action: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export const auditRepository = {
  async list(ctx: TenantCtx, params: AuditLogListParams) {
    return prisma.auditLog.findMany({
      where: {
        tenantId: ctx.orgId,
        ...(params.actorId ? { actorId: params.actorId } : {}),
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {}),
        ...(params.dateFrom || params.dateTo
          ? {
              createdAt: {
                ...(params.dateFrom ? { gte: params.dateFrom } : {}),
                ...(params.dateTo ? { lte: params.dateTo } : {}),
              },
            }
          : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },
};
