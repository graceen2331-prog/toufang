import { createApiHandler } from "@/server/api/handler";
import { getCreatorContact } from "@/server/modules/creator/creator.service";

// 查看联系方式：独立权限 + 审计（在 service 内落审计日志）
export const GET = createApiHandler({
  permission: "creator:contact:read",
  handler: async (ctx) =>
    getCreatorContact({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});
