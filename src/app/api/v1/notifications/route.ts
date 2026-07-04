import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/server/modules/notification/notification.service";
import { NotificationMarkReadSchema } from "@/shared/schemas/notification";

export const GET = createApiHandler({
  handler: async (ctx) => {
    const tenantCtx = { orgId: ctx.auth.orgId, userId: ctx.auth.userId };
    if (ctx.searchParams.get("count") === "unread") {
      return { unread: await countUnreadNotifications(tenantCtx) };
    }
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listNotifications(tenantCtx, {
      ...query,
      unreadOnly: ctx.searchParams.get("unread") === "true",
      type: ctx.searchParams.get("type"),
    });
    return paginated(items, pagination);
  },
});

export const PATCH = createApiHandler({
  body: NotificationMarkReadSchema,
  audit: "notification.mark_read",
  handler: async (ctx) => markNotificationsRead(
    { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
    ctx.body,
  ),
});
