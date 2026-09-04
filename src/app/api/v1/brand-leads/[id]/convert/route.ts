import { createApiHandler } from "@/server/api/handler";
import { ApiError } from "@/server/api/envelope";
import { requirePermission } from "@/server/auth/context";
import { convertBrandLead } from "@/server/modules/brand-lead/brand-lead.service";
import { BrandLeadConvertSchema } from "@/shared/schemas/brand-lead";

export const POST = createApiHandler({
  permission: "brand:write",
  body: BrandLeadConvertSchema,
  audit: "brand_lead.convert",
  handler: async (ctx) => {
    requirePermission(ctx.auth, "campaign:write");
    if (!ctx.params.id) throw new ApiError("VALIDATION_FAILED", "缺少品牌线索 ID");
    const result = await convertBrandLead(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id,
      ctx.body,
    );
    ctx.setAuditEntity("brand_lead", ctx.params.id, {
      brand_id: result.brand_id,
      campaign_id: result.campaign_id,
      already_converted: result.already_converted,
    });
    return result;
  },
});
