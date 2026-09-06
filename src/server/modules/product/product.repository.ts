import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma, Product } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface ProductListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  q: string | null;
  brandId: string | null;
}

export const productRepository = {
  async list(ctx: TenantCtx, params: ProductListParams): Promise<Array<Product & { brand: { name: string } }>> {
    return prisma.product.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.brandId ? { brandId: params.brandId } : {}),
        ...(params.q ? { name: { contains: params.q, mode: "insensitive" } } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: { brand: { select: { name: true } } },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async findById(ctx: TenantCtx, id: string): Promise<(Product & { brand: { name: string } }) | null> {
    return prisma.product.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: { brand: { select: { name: true } } },
    });
  },

  async create(
    ctx: TenantCtx,
    data: Omit<Prisma.ProductUncheckedCreateInput, "tenantId">,
  ): Promise<Product & { brand: { name: string } }> {
    return prisma.product.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
      include: { brand: { select: { name: true } } },
    });
  },

  async update(
    ctx: TenantCtx,
    id: string,
    data: Prisma.ProductUncheckedUpdateInput,
  ): Promise<(Product & { brand: { name: string } }) | null> {
    await prisma.product.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { ...data, updatedBy: ctx.userId ?? null },
    });
    return this.findById(ctx, id);
  },

  async softDelete(ctx: TenantCtx, id: string): Promise<void> {
    await prisma.product.updateMany({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: ctx.userId ?? null },
    });
  },
};
