import { createApiHandler } from "@/server/api/handler";
import { getContentAsset } from "@/server/modules/content/content.service";

export const GET = createApiHandler({
  permission: "content:read",
  handler: async (ctx) =>
    getContentAsset({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});
