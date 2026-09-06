import "server-only";
import { prisma } from "@/server/db/client";
import { Prisma, type BrandLead } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";

export interface BrandLeadListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  q: string | null;
  source: string | null;
  country: string | null;
  category: string | null;
  tier: string | null;
  seekingFunding: boolean | null;
}

export interface BrandLeadConversionRecord {
  lead: BrandLead;
  brand: { id: string; name: string };
  campaign: { id: string; name: string };
  alreadyConverted: boolean;
}

export interface BrandLeadConversionData {
  leadId: string;
  existingBrandId: string | null;
  newBrand: {
    name: string;
    slug: string;
    description: string | null;
    markets: string[];
  } | null;
  campaign: {
    name: string;
    objective: string;
    markets: string[];
    platforms: string[];
    goals: Record<string, string>;
  };
}

const SERIALIZATION_RETRY_LIMIT = 3;

export function isSerializationConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      error.code === "P2034" ||
      error.meta?.code === "40001" ||
      /40001|could not serialize access|serialization failure/i.test(error.message)
    );
  }
  return (
    error instanceof Error &&
    /40001|could not serialize access|serialization failure/i.test(error.message)
  );
}

async function withSerializableRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt >= SERIALIZATION_RETRY_LIMIT) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

export const brandLeadRepository = {
  async list(ctx: TenantCtx, params: BrandLeadListParams): Promise<BrandLead[]> {
    return prisma.brandLead.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.q
          ? {
              OR: [
                { name: { contains: params.q, mode: "insensitive" } },
                { description: { contains: params.q, mode: "insensitive" } },
                { website: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(params.source ? { source: params.source } : {}),
        ...(params.country ? { country: params.country } : {}),
        ...(params.category ? { productCategories: { has: params.category } } : {}),
        ...(params.tier ? { opportunityTier: params.tier } : {}),
        ...(params.seekingFunding ? { seekFunding: { contains: "yes", mode: "insensitive" } } : {}),
      },
      orderBy: [{ opportunityScore: "desc" }, { id: params.order }],
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      take: params.limit + 1,
    });
  },

  async findById(ctx: TenantCtx, id: string): Promise<BrandLead | null> {
    return prisma.brandLead.findFirst({ where: { id, tenantId: ctx.orgId, deletedAt: null } });
  },

  async upsertBySource(
    ctx: TenantCtx,
    data: Omit<Prisma.BrandLeadUncheckedCreateInput, "tenantId">,
  ): Promise<BrandLead> {
    return prisma.brandLead.upsert({
      where: {
        tenantId_source_sourceId: {
          tenantId: ctx.orgId,
          source: data.source ?? "manual",
          sourceId: data.sourceId,
        },
      },
      update: { ...data, updatedBy: ctx.userId ?? null },
      create: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async stats(ctx: TenantCtx) {
    const [total, priority, seekingFunding, countries, rows] = await Promise.all([
      prisma.brandLead.count({ where: { tenantId: ctx.orgId, deletedAt: null } }),
      prisma.brandLead.count({
        where: { tenantId: ctx.orgId, deletedAt: null, opportunityTier: "priority" },
      }),
      prisma.brandLead.count({
        where: {
          tenantId: ctx.orgId,
          deletedAt: null,
          seekFunding: { contains: "yes", mode: "insensitive" },
        },
      }),
      prisma.brandLead.findMany({
        where: { tenantId: ctx.orgId, deletedAt: null, country: { not: null } },
        select: { country: true },
        distinct: ["country"],
      }),
      prisma.brandLead.findMany({
        where: { tenantId: ctx.orgId, deletedAt: null },
        select: { productCategories: true },
      }),
    ]);

    const categoryCounts = new Map<string, number>();
    for (const row of rows) {
      for (const category of row.productCategories) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
    }

    return {
      total,
      priority,
      seekingFunding,
      countries: countries.length,
      topCategories: [...categoryCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count })),
    };
  },

  async convert(
    ctx: TenantCtx,
    data: BrandLeadConversionData,
  ): Promise<BrandLeadConversionRecord | null> {
    return withSerializableRetry(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "brand_leads"
          WHERE "id" = ${data.leadId}
            AND "tenant_id" = ${ctx.orgId}
            AND "deleted_at" IS NULL
          FOR UPDATE
        `;
      if (locked.length === 0) return null;

      const lead = await tx.brandLead.findFirst({
        where: { id: data.leadId, tenantId: ctx.orgId, deletedAt: null },
      });
      if (!lead) return null;

      if (lead.convertedCampaignId) {
        const campaign = await tx.campaign.findFirst({
          where: { id: lead.convertedCampaignId, tenantId: ctx.orgId },
          select: { id: true, name: true, brand: { select: { id: true, name: true } } },
        });
        if (!campaign) throw new Error("品牌线索关联的 Campaign 不存在");
        return {
          lead,
          brand: campaign.brand,
          campaign: { id: campaign.id, name: campaign.name },
          alreadyConverted: true,
        };
      }

      const brand = data.existingBrandId
        ? await tx.brand.findFirst({
            where: { id: data.existingBrandId, tenantId: ctx.orgId, deletedAt: null },
            select: { id: true, name: true },
          })
        : data.newBrand
          ? await tx.brand.create({
              data: {
                tenantId: ctx.orgId,
                createdBy: ctx.userId ?? null,
                name: data.newBrand.name,
                slug: data.newBrand.slug,
                description: data.newBrand.description,
                markets: data.newBrand.markets,
              },
              select: { id: true, name: true },
            })
          : null;
      if (!brand) return null;

      const campaign = await tx.campaign.create({
        data: {
          tenantId: ctx.orgId,
          brandId: brand.id,
          name: data.campaign.name,
          objective: data.campaign.objective,
          markets: data.campaign.markets,
          platforms: data.campaign.platforms,
          goals: data.campaign.goals,
          createdBy: ctx.userId ?? null,
          ownerId: ctx.userId ?? null,
        },
        select: { id: true, name: true, status: true },
      });
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "campaign",
          entityId: campaign.id,
          fromValue: null,
          toValue: campaign.status,
          actorId: ctx.userId ?? null,
          metadata: { source: "brand_lead", brand_lead_id: lead.id },
        },
        tx,
      );

      const convertedAt = new Date();
      const updated = await tx.brandLead.updateMany({
        where: {
          id: lead.id,
          tenantId: ctx.orgId,
          deletedAt: null,
          convertedCampaignId: null,
        },
        data: {
          convertedCampaignId: campaign.id,
          convertedAt,
          convertedById: ctx.userId ?? null,
          updatedBy: ctx.userId ?? null,
        },
      });
      if (updated.count !== 1) throw new Error("品牌线索转换发生并发冲突");

      return {
        lead: {
          ...lead,
          convertedCampaignId: campaign.id,
          convertedAt,
          convertedById: ctx.userId ?? null,
        },
        brand,
        campaign: { id: campaign.id, name: campaign.name },
        alreadyConverted: false,
      };
    });
  },
};
