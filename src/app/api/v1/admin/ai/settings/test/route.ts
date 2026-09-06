import { createApiHandler } from "@/server/api/handler";
import { testAiSettings } from "@/server/modules/admin/admin.service";
import { AiSettingsTestSchema } from "@/shared/schemas/admin";

export const POST = createApiHandler({
  permission: "admin:ai_settings",
  body: AiSettingsTestSchema,
  audit: "admin.ai_settings_test",
  handler: async (ctx) => {
    ctx.setAuditEntity("organization", ctx.auth.orgId);
    return testAiSettings({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
  },
});
