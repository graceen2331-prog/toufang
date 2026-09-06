import { createApiHandler } from "@/server/api/handler";
import {
  removeCampaignCreator,
  transitionCampaignCreator,
} from "@/server/modules/campaign/campaign.service";
import { CampaignCreatorStatusSchema } from "@/shared/schemas/campaign";

export const POST = createApiHandler({
  permission: "campaign:write",
  body: CampaignCreatorStatusSchema,
  audit: "campaign_creator.status_change",
  handler: async (ctx) => {
    await transitionCampaignCreator(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.ccId!,
      ctx.body.field,
      ctx.body.to,
      ctx.body.reason,
    );
    ctx.setAuditEntity("campaign_creator", ctx.params.ccId!, {
      field: ctx.body.field,
      to: ctx.body.to,
    });
    return { updated: true };
  },
});

export const DELETE = createApiHandler({
  permission: "campaign:write",
  audit: "campaign_creator.remove",
  handler: async (ctx) => {
    await removeCampaignCreator(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.ccId!,
    );
    ctx.setAuditEntity("campaign_creator", ctx.params.ccId!);
    return { deleted: true };
  },
});
