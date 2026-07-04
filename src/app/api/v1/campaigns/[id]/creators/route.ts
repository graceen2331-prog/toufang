import { createApiHandler } from "@/server/api/handler";
import {
  addCampaignCreators,
  listCampaignCreators,
} from "@/server/modules/campaign/campaign.service";
import { CampaignCreatorAddSchema } from "@/shared/schemas/campaign";

export const GET = createApiHandler({
  permission: "campaign:read",
  handler: async (ctx) =>
    listCampaignCreators({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const POST = createApiHandler({
  permission: "campaign:write",
  body: CampaignCreatorAddSchema,
  audit: "campaign.creators_add",
  created: true,
  handler: async (ctx) => {
    const result = await addCampaignCreators(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.creator_ids,
      ctx.body.role ?? null,
    );
    ctx.setAuditEntity("campaign", ctx.params.id!, { added: result.added });
    return result;
  },
});
