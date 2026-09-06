import { createApiHandler } from "@/server/api/handler";
import { transitionCampaignStatus } from "@/server/modules/campaign/campaign.service";
import { CampaignStatusSchema } from "@/shared/schemas/campaign";

export const POST = createApiHandler({
  permission: "campaign:status",
  body: CampaignStatusSchema,
  audit: "campaign.status_change",
  handler: async (ctx) => {
    const campaign = await transitionCampaignStatus(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("campaign", campaign.id, { to: ctx.body.to });
    return campaign;
  },
});
