import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createCampaign, listCampaigns } from "@/server/modules/campaign/campaign.service";
import { CampaignCreateSchema } from "@/shared/schemas/campaign";

export const GET = createApiHandler({
  permission: "campaign:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listCampaigns(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        status: ctx.searchParams.get("status"),
        brandId: ctx.searchParams.get("brand_id"),
      },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "campaign:write",
  body: CampaignCreateSchema,
  audit: "campaign.create",
  created: true,
  handler: async (ctx) => {
    const campaign = await createCampaign(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("campaign", campaign.id, { name: campaign.name });
    return campaign;
  },
});
