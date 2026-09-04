import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { listBrandLeads, upsertBrandLead } from "@/server/modules/brand-lead/brand-lead.service";
import { BrandLeadCreateSchema } from "@/shared/schemas/brand-lead";

export const GET = createApiHandler({
  permission: "brand:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams, { sortable: ["created_at"], defaultSort: "created_at" });
    const { items, pagination } = await listBrandLeads(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      {
        ...query,
        source: ctx.searchParams.get("source"),
        country: ctx.searchParams.get("country"),
        category: ctx.searchParams.get("category"),
        tier: ctx.searchParams.get("tier"),
        seekingFunding: ctx.searchParams.get("seeking_funding") === "true",
      },
    );
    return paginated(items, pagination);
  },
});

export const POST = createApiHandler({
  permission: "brand:write",
  body: BrandLeadCreateSchema,
  audit: "brand_lead.upsert",
  created: true,
  handler: async (ctx) => {
    const lead = await upsertBrandLead({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
    ctx.setAuditEntity("brand_lead", lead.id, { source: lead.source, source_id: lead.source_id });
    return lead;
  },
});
