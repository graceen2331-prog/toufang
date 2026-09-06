import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { listAuditLogs, parseAuditDate } from "@/server/modules/audit/audit-log.service";

export const GET = createApiHandler({
  permission: "admin:audit",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listAuditLogs(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        actorId: ctx.searchParams.get("actor_id"),
        entityType: ctx.searchParams.get("entity_type"),
        action: ctx.searchParams.get("action"),
        dateFrom: parseAuditDate(ctx.searchParams.get("date_from")),
        dateTo: parseAuditDate(ctx.searchParams.get("date_to"), true),
      },
    );
    return paginated(items, pagination);
  },
});
