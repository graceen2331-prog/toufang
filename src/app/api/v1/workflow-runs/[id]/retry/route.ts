import { createApiHandler } from "@/server/api/handler";
import { retryWorkflow } from "@/server/workflows/engine";

export const POST = createApiHandler({
  permission: "ai:run",
  audit: "workflow.retry",
  handler: async (ctx) => {
    await retryWorkflow({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!);
    ctx.setAuditEntity("workflow_run", ctx.params.id!);
    return { retried: true };
  },
});
