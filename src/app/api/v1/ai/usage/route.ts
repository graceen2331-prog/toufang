import { createApiHandler } from "@/server/api/handler";
import { getAiUsageSummary } from "@/server/modules/workflow/workflow.service";

export const GET = createApiHandler({
  permission: "ai:monitor",
  handler: async (ctx) =>
    getAiUsageSummary({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});
