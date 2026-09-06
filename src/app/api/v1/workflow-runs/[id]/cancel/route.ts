import { createApiHandler } from "@/server/api/handler";
import { cancelWorkflow } from "@/server/workflows/engine";

export const POST = createApiHandler({
  permission: "ai:run",
  audit: "workflow.cancel",
  handler: async (ctx) => {
    await cancelWorkflow({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!);
    ctx.setAuditEntity("workflow_run", ctx.params.id!);
    return { cancelled: true };
  },
});
