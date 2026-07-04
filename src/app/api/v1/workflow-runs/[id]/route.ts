import { createApiHandler } from "@/server/api/handler";
import { getWorkflowRun } from "@/server/modules/workflow/workflow.service";

// 触发工作流的用户与监控者都需要查看运行状态，因此用 ai:run 即可查看单个 run
export const GET = createApiHandler({
  permission: "ai:run",
  handler: async (ctx) =>
    getWorkflowRun({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});
