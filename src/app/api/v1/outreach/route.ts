import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createThread, listThreads } from "@/server/modules/outreach/outreach.service";
import { OutreachThreadCreateSchema } from "@/shared/schemas/outreach";

export const GET = createApiHandler({
  permission: "outreach:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listThreads(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        status: ctx.searchParams.get("status"),
        campaignId: ctx.searchParams.get("campaign_id"),
      },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "outreach:write",
  body: OutreachThreadCreateSchema,
  audit: "outreach.thread_create",
  created: true,
  handler: async (ctx) => {
    const thread = await createThread({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
    ctx.setAuditEntity("outreach_thread", thread.id, {
      campaign_creator_id: thread.campaign_creator_id,
    });
    return thread;
  },
});
