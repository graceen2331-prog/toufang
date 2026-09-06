import { createApiHandler } from "@/server/api/handler";
import { listStatusEvents } from "@/server/modules/status-events/status-event.repository";

export const GET = createApiHandler({
  permission: "campaign:read",
  handler: async (ctx) => listStatusEvents(ctx.auth.orgId, "campaign", ctx.params.id!),
});
