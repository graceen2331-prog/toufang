import { createApiHandler } from "@/server/api/handler";
import { updateInsightStatus } from "@/server/modules/analytics/analytics.service";
import { InsightStatusSchema } from "@/shared/schemas/content-analytics";

export const POST = createApiHandler({
  permission: "analytics:read",
  body: InsightStatusSchema,
  audit: "insight.status",
  handler: async (ctx) => {
    const insight = await updateInsightStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.status,
    );
    ctx.setAuditEntity("insight", insight.id, { status: ctx.body.status });
    return insight;
  },
});
