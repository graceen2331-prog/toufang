import { createApiHandler } from "@/server/api/handler";
import { getAgentMonitorSummary } from "@/server/modules/agent-monitor/agent-monitor.service";

export const GET = createApiHandler({
  permission: "ai:monitor",
  handler: async (ctx) =>
    getAgentMonitorSummary({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});
