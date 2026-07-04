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
}

export const checkpointRepository = {
  async list(ctx: TenantCtx, params: CheckpointListParams): Promise<HumanCheckpoint[]> {
    return prisma.humanCheckpoint.findMany({
      where: {
        tenantId: ctx.orgId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
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
