import { createApiHandler } from "@/server/api/handler";
import { getAiSettings, updateAiSettings } from "@/server/modules/admin/admin.service";
import { AiSettingsUpdateSchema } from "@/shared/schemas/admin";

export const GET = createApiHandler({
  permission: "admin:ai_settings",
  handler: async (ctx) => getAiSettings({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});

export const PATCH = createApiHandler({
  permission: "admin:ai_settings",
  body: AiSettingsUpdateSchema,
  audit: "admin.ai_settings_update",
  handler: async (ctx) => {
    ctx.setAuditEntity("organization", ctx.auth.orgId);
    return updateAiSettings({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
  },
});
