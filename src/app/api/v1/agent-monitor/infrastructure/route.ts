import { createApiHandler } from "@/server/api/handler";
import { getAgentInfrastructure } from "@/server/modules/agent-monitor/agent-monitor.service";

export const GET = createApiHandler({
  permission: "admin:ai_infrastructure",
  handler: async () => getAgentInfrastructure(),
});
