import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createProduct, listProducts } from "@/server/modules/product/product.service";
import { ProductCreateSchema } from "@/shared/schemas/product";

export const GET = createApiHandler({
  permission: "brand:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listProducts(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      { ...query, brandId: ctx.searchParams.get("brand_id") },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "brand:write",
  body: ProductCreateSchema,
  audit: "product.create",
  created: true,
  handler: async (ctx) => {
    const product = await createProduct(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("product", product.id, { name: product.name });
    return product;
  },
});
