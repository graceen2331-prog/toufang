import { createApiHandler } from "@/server/api/handler";
import { getBriefVersion } from "@/server/modules/brief/brief.service";

export const GET = createApiHandler({
  permission: "brief:read",
  handler: async (ctx) =>
    getBriefVersion({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.versionId!),
});
