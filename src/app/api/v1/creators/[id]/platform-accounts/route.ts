import { createApiHandler } from "@/server/api/handler";
import { addPlatformAccount } from "@/server/modules/creator/creator.service";
import { PlatformAccountSchema } from "@/shared/schemas/creator";

export const POST = createApiHandler({
  permission: "creator:write",
  body: PlatformAccountSchema,
  audit: "creator.account_add",
  created: true,
  handler: async (ctx) => {
    const account = await addPlatformAccount(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("creator", ctx.params.id!, { platform: account.platform });
    return account;
  },
});
