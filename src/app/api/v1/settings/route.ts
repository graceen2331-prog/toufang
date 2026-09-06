import { createApiHandler } from "@/server/api/handler";
import { getUserSettings, updateUserSettings } from "@/server/modules/admin/admin.service";
import { UserSettingsUpdateSchema } from "@/shared/schemas/settings";

export const GET = createApiHandler({
  handler: async (ctx) => getUserSettings({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});

export const PATCH = createApiHandler({
  body: UserSettingsUpdateSchema,
  audit: "settings.update",
  handler: async (ctx) => {
    const settings = await updateUserSettings(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("user", settings.user.id);
    return settings;
  },
});
