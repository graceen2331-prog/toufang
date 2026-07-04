import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { listWorkflowRuns } from "@/server/modules/workflow/workflow.service";

export const GET = createApiHandler({
  permission: "ai:monitor",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listWorkflowRuns(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        status: ctx.searchParams.get("status"),
        workflowKey: ctx.searchParams.get("workflow_key"),
      },
    );
    return paginated(items, pagination);
  },
});
