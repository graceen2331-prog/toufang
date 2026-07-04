import { createApiHandler } from "@/server/api/handler";
import { getThread } from "@/server/modules/outreach/outreach.service";

export const GET = createApiHandler({
  permission: "outreach:read",
  handler: async (ctx) =>
    getThread({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});
