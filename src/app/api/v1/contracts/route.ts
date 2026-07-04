import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createContract, listContracts } from "@/server/modules/contract/contract.service";
import { ContractCreateSchema } from "@/shared/schemas/outreach";

export const GET = createApiHandler({
  permission: "contract:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const { items, pagination } = await listContracts(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        status: ctx.searchParams.get("status"),
        campaignId: ctx.searchParams.get("campaign_id"),
      },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "contract:write",
  body: ContractCreateSchema,
  audit: "contract.create",
  created: true,
  handler: async (ctx) => {
    const contract = await createContract(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.body,
    );
    ctx.setAuditEntity("contract", contract.id, {
      campaign_creator_id: contract.campaign_creator_id,
    });
    return contract;
  },
});
