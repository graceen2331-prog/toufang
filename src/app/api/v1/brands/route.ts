import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createBrand, listBrands } from "@/server/modules/brand/brand.service";
import { BrandCreateSchema } from "@/shared/schemas/brand";

export const GET = createApiHandler({
  permission: "brand:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listBrands(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      query,
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "brand:write",
  body: BrandCreateSchema,
  audit: "brand.create",
  created: true,
  handler: async (ctx) => {
    const brand = await createBrand({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
    ctx.setAuditEntity("brand", brand.id, { name: brand.name });
    return brand;
  },
});
