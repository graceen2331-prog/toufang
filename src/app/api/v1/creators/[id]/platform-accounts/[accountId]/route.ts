import { createApiHandler } from "@/server/api/handler";
import {
  removePlatformAccount,
  updatePlatformAccount,
} from "@/server/modules/creator/creator.service";
import { PlatformAccountSchema } from "@/shared/schemas/creator";

export const PATCH = createApiHandler({
  permission: "creator:write",
  body: PlatformAccountSchema,
  audit: "creator.account_update",
  handler: async (ctx) => {
    await updatePlatformAccount(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.params.accountId!,
      ctx.body,
    );
    ctx.setAuditEntity("creator", ctx.params.id!);
    return { updated: true };
  },
});

export const DELETE = createApiHandler({
  permission: "creator:write",
  audit: "creator.account_remove",
  handler: async (ctx) => {
    await removePlatformAccount(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.params.accountId!,
    );
    ctx.setAuditEntity("creator", ctx.params.id!);
    return { deleted: true };
  },
});
