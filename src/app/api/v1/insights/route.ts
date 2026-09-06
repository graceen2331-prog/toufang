import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { listInsights } from "@/server/modules/analytics/analytics.service";

export const GET = createApiHandler({
  permission: "analytics:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listInsights(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        campaignId: ctx.searchParams.get("campaign_id"),
        status: ctx.searchParams.get("status"),
      },
    );
    return paginated(items, pagination);
  },
});
