import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma, Brand } from "@/generated/prisma/client";

/** 所有 repository 方法的第一个参数：租户上下文（强制隔离） */
export interface TenantCtx {
  orgId: string;
  userId?: string;
}

export interface BrandListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  q: string | null;
}

export const brandRepository = {
  async list(ctx: TenantCtx, params: BrandListParams): Promise<Brand[]> {
    return prisma.brand.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.q ? { name: { contains: params.q, mode: "insensitive" } } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async countProducts(ctx: TenantCtx, brandIds: string[]): Promise<Map<string, number>> {
    const rows = await prisma.product.groupBy({
      by: ["brandId"],
      where: { tenantId: ctx.orgId, brandId: { in: brandIds }, deletedAt: null },
      _count: true,
    });
    return new Map(rows.map((r) => [r.brandId, r._count]));
  },

  async findById(ctx: TenantCtx, id: string): Promise<Brand | null> {
    return prisma.brand.findFirst({ where: { id, tenantId: ctx.orgId, deletedAt: null } });
  },

  async findBySlug(ctx: TenantCtx, slug: string): Promise<Brand | null> {
    return prisma.brand.findFirst({ where: { slug, tenantId: ctx.orgId, deletedAt: null } });
  },

  async create(ctx: TenantCtx, data: Omit<Prisma.BrandUncheckedCreateInput, "tenantId">): Promise<Brand> {
    return prisma.brand.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async update(ctx: TenantCtx, id: string, data: Prisma.BrandUncheckedUpdateInput): Promise<Brand> {
    // updateMany + tenant 条件保证不会跨租户更新
    await prisma.brand.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
    const updated = await this.findById(ctx, id);
    if (!updated) throw new Error(`brand ${id} 更新后读取失败`);
    return updated;
  },

  async softDelete(ctx: TenantCtx, id: string): Promise<void> {
    await prisma.brand.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: ctx.userId ?? null },
    });
  },
};
