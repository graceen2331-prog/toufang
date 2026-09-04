import { createApiHandler } from "@/server/api/handler";
import { getAgentRun } from "@/server/modules/agent-monitor/agent-monitor.service";

export const GET = createApiHandler({
  permission: "ai:monitor",
  handler: async (ctx) =>
    getAgentRun({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});
