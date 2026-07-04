import { createApiHandler } from "@/server/api/handler";
import { analyzeNegotiation } from "@/server/modules/outreach/outreach.service";
import { NegotiationAnalyzeSchema } from "@/shared/schemas/outreach";

export const POST = createApiHandler({
  permission: "ai:run",
  body: NegotiationAnalyzeSchema,
  audit: "outreach.negotiation_analyze",
  created: true,
  handler: async (ctx) => {
    const negotiation = await analyzeNegotiation(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("negotiation_record", negotiation.id);
    return negotiation;
  },
});
