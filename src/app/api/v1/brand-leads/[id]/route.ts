import { createApiHandler } from "@/server/api/handler";
import { ApiError } from "@/server/api/envelope";
import { getBrandLead } from "@/server/modules/brand-lead/brand-lead.service";

export const GET = createApiHandler({
  permission: "brand:read",
  handler: async (ctx) => {
    if (!ctx.params.id) throw new ApiError("VALIDATION_FAILED", "缺少品牌线索 ID");
    return getBrandLead({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id);
  },
});
