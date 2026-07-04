import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createContentAsset, listContentAssets } from "@/server/modules/content/content.service";
import { ContentAssetCreateSchema } from "@/shared/schemas/content-analytics";

export const GET = createApiHandler({
  permission: "content:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listContentAssets(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        status: ctx.searchParams.get("status"),
        campaignId: ctx.searchParams.get("campaign_id"),
      },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "content:review",
  body: ContentAssetCreateSchema,
  audit: "content_asset.create",
  created: true,
  handler: async (ctx) => {
    const asset = await createContentAsset(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("content_asset", asset.id);
    return asset;
  },
});
