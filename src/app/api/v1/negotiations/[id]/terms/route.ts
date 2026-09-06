import { createApiHandler } from "@/server/api/handler";
import { confirmTerms } from "@/server/modules/outreach/outreach.service";
import { AgreedTermsSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "outreach:write",
  body: AgreedTermsSchema,
  audit: "outreach.terms_confirm",
  handler: async (ctx) => {
    const negotiation = await confirmTerms(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("negotiation_record", negotiation.id);
    return negotiation;
  },
});
