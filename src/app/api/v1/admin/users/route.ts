import { createApiHandler } from "@/server/api/handler";
import { getAdminUsersPage } from "@/server/modules/admin/admin.service";

export const GET = createApiHandler({
  permission: "admin:users",
  handler: async (ctx) => getAdminUsersPage({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});
