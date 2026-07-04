import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createCreator, listCreators } from "@/server/modules/creator/creator.service";
import { CreatorCreateSchema } from "@/shared/schemas/creator";

export const GET = createApiHandler({
  permission: "creator:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);
    const sp = ctx.searchParams;
    const minFollowers = sp.get("min_followers") ? Number(sp.get("min_followers")) : null;
    const { items, pagination } = await listCreators(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        platform: sp.get("platform"),
        relationshipStatus: sp.get("relationship_status"),
        riskLevel: sp.get("risk_level"),
        country: sp.get("country"),
        tag: sp.get("tag"),
        minFollowers: minFollowers && !Number.isNaN(minFollowers) ? minFollowers : null,
      },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "creator:write",
  body: CreatorCreateSchema,
  audit: "creator.create",
  created: true,
  handler: async (ctx) => {
    const creator = await createCreator({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
    ctx.setAuditEntity("creator", creator.id, { name: creator.display_name });
    return creator;
  },
});
