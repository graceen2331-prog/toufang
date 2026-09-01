import { createApiHandler } from "@/server/api/handler";
import { getWorkflowExecutionHealth } from "@/server/modules/workflow/workflow-health.service";

export const GET = createApiHandler({
  permission: "ai:run",
  handler: async (ctx) =>
    getWorkflowExecutionHealth(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
    ),
});
