import { createApiHandler } from "@/server/api/handler";
import { deleteCreator, getCreator, updateCreator } from "@/server/modules/creator/creator.service";
import { CreatorUpdateSchema } from "@/shared/schemas/creator";

export const GET = createApiHandler({
  permission: "creator:read",
  handler: async (ctx) =>
    getCreator({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const PATCH = createApiHandler({
  permission: "creator:write",
  body: CreatorUpdateSchema,
  audit: "creator.update",
  handler: async (ctx) => {
    const creator = await updateCreator(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("creator", creator.id);
    return creator;
  },
});

export const DELETE = createApiHandler({
  permission: "creator:write",
  audit: "creator.delete",
  handler: async (ctx) => {
    await deleteCreator({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!);
    ctx.setAuditEntity("creator", ctx.params.id!);
    return { deleted: true };
  },
});
