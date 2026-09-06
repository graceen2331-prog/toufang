import { createApiHandler } from "@/server/api/handler";
import { deleteBrand, getBrand, updateBrand } from "@/server/modules/brand/brand.service";
import { BrandUpdateSchema } from "@/shared/schemas/brand";

export const GET = createApiHandler({
  permission: "brand:read",
  handler: async (ctx) =>
    getBrand({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const PATCH = createApiHandler({
  permission: "brand:write",
  body: BrandUpdateSchema,
  audit: "brand.update",
  handler: async (ctx) => {
    const brand = await updateBrand(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("brand", brand.id);
    return brand;
  },
});

export const DELETE = createApiHandler({
  permission: "brand:write",
  audit: "brand.delete",
  handler: async (ctx) => {
    await deleteBrand({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!);
    ctx.setAuditEntity("brand", ctx.params.id!);
    return { deleted: true };
  },
});
