import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { listAgentRuns, parseAgentMonitorDate } from "@/server/modules/agent-monitor/agent-monitor.service";

export const GET = createApiHandler({
  permission: "ai:monitor",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const mode = ctx.searchParams.get("mode");
    const anomaly = ctx.searchParams.get("anomaly");
    const { items, pagination } = await listAgentRuns(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        limit: query.limit,
        cursor: query.cursor,
        order: query.order,
        status: ctx.searchParams.get("status"),
        agentKey: ctx.searchParams.get("agent_key"),
        provider: ctx.searchParams.get("provider"),
        model: ctx.searchParams.get("model"),
        mode: mode === "workflow" || mode === "sync" ? mode : null,
        anomaly:
          anomaly === "failed" || anomaly === "stuck" || anomaly === "slow" ? anomaly : null,
        dateFrom: parseAgentMonitorDate(ctx.searchParams.get("date_from")),
        dateTo: parseAgentMonitorDate(ctx.searchParams.get("date_to"), true),
      },
    );
    return paginated(items, pagination);
  },
});
