import { createApiHandler } from "@/server/api/handler";
import {
  deleteCampaign,
  getCampaign,
  updateCampaign,
} from "@/server/modules/campaign/campaign.service";
import { CampaignUpdateSchema } from "@/shared/schemas/campaign";

export const GET = createApiHandler({
  permission: "campaign:read",
  handler: async (ctx) =>
    getCampaign({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const PATCH = createApiHandler({
  permission: "campaign:write",
  body: CampaignUpdateSchema,
  audit: "campaign.update",
  handler: async (ctx) => {
    const campaign = await updateCampaign(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body,
    );
    ctx.setAuditEntity("campaign", campaign.id);
    return campaign;
  },
});

export const DELETE = createApiHandler({
  permission: "campaign:write",
  audit: "campaign.delete",
  handler: async (ctx) => {
    await deleteCampaign({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!);
    ctx.setAuditEntity("campaign", ctx.params.id!);
    return { deleted: true };
  },
});
