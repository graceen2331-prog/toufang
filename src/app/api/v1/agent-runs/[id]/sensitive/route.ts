import { createApiHandler } from "@/server/api/handler";
import { getAgentRunSensitive } from "@/server/modules/agent-monitor/agent-monitor.service";

export const GET = createApiHandler({
  permission: "admin:ai_trace",
  audit: "agent_run.sensitive_view",
  handler: async (ctx) => {
    ctx.setAuditEntity("agent_run", ctx.params.id!, { sections: ["prompt", "input", "output", "calls"] });
    return getAgentRunSensitive(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
    );
  },
});
