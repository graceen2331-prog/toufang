import { createApiHandler } from "@/server/api/handler";
import { listStatusEvents } from "@/server/modules/status-events/status-event.repository";

export const GET = createApiHandler({
  permission: "creator:read",
  handler: async (ctx) => listStatusEvents(ctx.auth.orgId, "creator", ctx.params.id!),
});
