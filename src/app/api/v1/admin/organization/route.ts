import { createApiHandler } from "@/server/api/handler";
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/server/modules/admin/admin.service";
import { OrganizationUpdateSchema } from "@/shared/schemas/admin";

export const GET = createApiHandler({
  permission: "admin:users",
  handler: async (ctx) => getOrganizationSettings({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});

export const PATCH = createApiHandler({
  permission: "admin:users",
  body: OrganizationUpdateSchema,
  audit: "admin.organization_update",
  handler: async (ctx) => {
    const org = await updateOrganizationSettings(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("organization", org.id);
    return org;
  },
});
