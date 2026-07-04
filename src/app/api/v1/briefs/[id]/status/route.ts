import { createApiHandler } from "@/server/api/handler";
import { transitionBriefStatus } from "@/server/modules/brief/brief.service";
import { BriefStatusSchema } from "@/shared/schemas/brief";

export const POST = createApiHandler({
  permission: "brief:write",
  body: BriefStatusSchema,
  audit: "brief.status_change",
  handler: async (ctx) => {
    await transitionBriefStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("brief", ctx.params.id!, { to: ctx.body.to });
    return { updated: true };
  },
});
