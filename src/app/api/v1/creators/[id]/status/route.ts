import { createApiHandler } from "@/server/api/handler";
import { transitionCreatorStatus } from "@/server/modules/creator/creator.service";
import { CreatorStatusSchema } from "@/shared/schemas/creator";

export const POST = createApiHandler({
  permission: "creator:write",
  body: CreatorStatusSchema,
  audit: "creator.status_change",
  handler: async (ctx) => {
    const creator = await transitionCreatorStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("creator", creator.id, { to: ctx.body.to });
    return creator;
  },
});
