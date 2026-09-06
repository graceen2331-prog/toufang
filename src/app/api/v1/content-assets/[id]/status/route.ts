import { createApiHandler } from "@/server/api/handler";
import { transitionContentAssetStatus } from "@/server/modules/content/content.service";
import { ContentAssetStatusSchema } from "@/shared/schemas/content-analytics";

export const POST = createApiHandler({
  permission: "content:review",
  body: ContentAssetStatusSchema,
  audit: "content_asset.transition",
  handler: async (ctx) => {
    const asset = await transitionContentAssetStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("content_asset", asset.id, { to: ctx.body.to });
    return asset;
  },
});
