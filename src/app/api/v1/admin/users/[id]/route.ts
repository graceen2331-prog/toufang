import { createApiHandler } from "@/server/api/handler";
import { updateAdminUser } from "@/server/modules/admin/admin.service";
import { AdminUserUpdateSchema } from "@/shared/schemas/admin";

export const PATCH = createApiHandler({
  permission: "admin:users",
  body: AdminUserUpdateSchema,
  audit: "admin.user_update",
  handler: async (ctx) => {
    const user = await updateAdminUser(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("user", user.user_id, ctx.body);
    return user;
  },
});
