import { createApiHandler } from "@/server/api/handler";
import { getBrandLeadStats } from "@/server/modules/brand-lead/brand-lead.service";

export const GET = createApiHandler({
  permission: "brand:read",
  handler: async (ctx) => getBrandLeadStats({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }),
});
