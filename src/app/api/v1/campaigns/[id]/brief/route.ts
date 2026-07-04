import { createApiHandler } from "@/server/api/handler";
import { getBriefByCampaign, saveBriefVersion } from "@/server/modules/brief/brief.service";
import { BriefVersionCreateSchema } from "@/shared/schemas/brief";

export const GET = createApiHandler({
  permission: "brief:read",
  handler: async (ctx) =>
    getBriefByCampaign({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const POST = createApiHandler({
  permission: "brief:write",
  body: BriefVersionCreateSchema,
  audit: "brief.version_save",
  created: true,
  handler: async (ctx) => {
    const brief = await saveBriefVersion(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.content,
      ctx.body.change_summary,
    );
    ctx.setAuditEntity("brief", brief.id);
    return brief;
  },
});
