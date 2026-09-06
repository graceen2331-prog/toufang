import { createApiHandler } from "@/server/api/handler";
import { deleteProduct, getProduct, updateProduct } from "@/server/modules/product/product.service";
import { ProductUpdateSchema } from "@/shared/schemas/product";

export const GET = createApiHandler({
  permission: "brand:read",
  handler: async (ctx) =>
    getProduct({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const PATCH = createApiHandler({
  permission: "brand:write",
  body: ProductUpdateSchema,
  audit: "product.update",
  handler: async (ctx) => {
    const product = await updateProduct(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("product", product.id);
    return product;
  },
});

export const DELETE = createApiHandler({
  permission: "brand:write",
  audit: "product.delete",
  handler: async (ctx) => {
    await deleteProduct({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!);
    ctx.setAuditEntity("product", ctx.params.id!);
    return { deleted: true };
  },
});
