import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import {
  countPendingCheckpoints,
  listCheckpoints,
} from "@/server/modules/checkpoint/checkpoint.service";

export const GET = createApiHandler({
  permission: "approval:read",
  handler: async (ctx) => {
    if (ctx.searchParams.get("count") === "pending") {
      const count = await countPendingCheckpoints({ orgId: ctx.auth.orgId });
      return { pending: count };
    }
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listCheckpoints(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        status: ctx.searchParams.get("status"),
        type: ctx.searchParams.get("type"),
        campaignId: ctx.searchParams.get("campaign_id"),
        assignee: ctx.searchParams.get("assignee"),
        createdBy: ctx.searchParams.get("created_by"),
        overdue: ctx.searchParams.get("overdue") === "true" ? true : undefined,
        priority: ctx.searchParams.get("priority"),
      },
    );
    return paginated(items, pagination);
  },
});
