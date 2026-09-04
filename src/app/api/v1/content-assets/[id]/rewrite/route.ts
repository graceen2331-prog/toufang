import { createApiHandler } from "@/server/api/handler";
import { rewriteContentAssetWithAi } from "@/server/modules/content/content.service";
import { ContentRewriteSchema } from "@/shared/schemas/content-analytics";

export const POST = createApiHandler({
  permission: "content:review",
  body: ContentRewriteSchema,
  audit: "content_asset.ai_rewrite",
  handler: async (ctx) => {
    const result = await rewriteContentAssetWithAi(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("content_asset", result.content_asset.id, {
      agent_run_id: result.agent_run_id,
    });
    return result;
  },
});
