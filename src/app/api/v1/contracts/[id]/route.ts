import { createApiHandler } from "@/server/api/handler";
import { getContract } from "@/server/modules/contract/contract.service";

export const GET = createApiHandler({
  permission: "contract:read",
  handler: async (ctx) =>
    getContract({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});
