import { createApiHandler } from "@/server/api/handler";
import { listCheckpointEvents } from "@/server/modules/checkpoint/checkpoint.service";

export const GET = createApiHandler({
  permission: "approval:read",
  handler: async (ctx) => listCheckpointEvents({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});
