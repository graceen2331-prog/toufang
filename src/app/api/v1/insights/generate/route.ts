import { createApiHandler } from "@/server/api/handler";
import { startAnalyticsWorkflow } from "@/server/modules/analytics/analytics.service";
import { GenerateAnalyticsSchema } from "@/shared/schemas/content-analytics";

export const POST = createApiHandler({
  permission: "ai:run",
  body: GenerateAnalyticsSchema,
  audit: "analytics.generate",
  created: true,
  handler: async (ctx) => {
    const run = await startAnalyticsWorkflow(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("campaign", ctx.body.campaign_id, { workflow_run_id: run.workflow_run_id });
    return run;
  },
});
