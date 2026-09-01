import { createApiHandler } from "@/server/api/handler";
import { retryWorkflow } from "@/server/workflows/engine";

export const POST = createApiHandler({
  permission: "ai:run",
  audit: "workflow.retry",
  handler: async (ctx) => {
    const sourceRunId = ctx.params.id!;
    const run = await retryWorkflow(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      sourceRunId,
    );
    ctx.setAuditEntity("workflow_run", run.id);
    return {
      workflow_run_id: run.id,
      retry_of_run_id: sourceRunId,
      poll_url: `/api/v1/workflow-runs/${run.id}`,
      events_url: `/api/v1/workflow-runs/${run.id}/events`,
    };
  },
});
