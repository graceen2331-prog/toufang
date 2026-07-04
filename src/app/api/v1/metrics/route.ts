import { createApiHandler } from "@/server/api/handler";
import { getAnalyticsOverview, upsertMetric } from "@/server/modules/analytics/analytics.service";
import { MetricUpsertSchema } from "@/shared/schemas/content-analytics";

export const GET = createApiHandler({
  permission: "analytics:read",
  handler: async (ctx) =>
    getAnalyticsOverview(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        campaignId: ctx.searchParams.get("campaign_id"),
        dateFrom: ctx.searchParams.get("date_from"),
        dateTo: ctx.searchParams.get("date_to"),
      },
    ),
});

export const POST = createApiHandler({
  permission: "analytics:read",
  body: MetricUpsertSchema,
  audit: "metric.upsert",
  created: true,
  handler: async (ctx) => {
    const metric = await upsertMetric({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
    ctx.setAuditEntity("performance_metric", metric.id);
    return metric;
  },
});
