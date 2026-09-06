import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import type { BrandLead, Prisma } from "@/generated/prisma/client";
import type {
  BrandLeadCreateInput,
  BrandLeadConvertInput,
  BrandLeadConversionDto,
  BrandLeadDto,
  BrandLeadStatsDto,
} from "@/shared/schemas/brand-lead";
import { normalizeExternalUrl } from "@/shared/url";
import { brandLeadRepository, type BrandLeadListParams } from "./brand-lead.repository";
import { generateChineseBrandName, generateChineseBrandProfile } from "./brand-lead.localization";
import { scoreBrandLead } from "./brand-lead.scoring";

function toDto(lead: BrandLead): BrandLeadDto {
  return {
    id: lead.id,
    source: lead.source,
    source_id: lead.sourceId,
    name: lead.name,
    name_zh: lead.nameZh,
    website: lead.website,
    country: lead.country,
    description: lead.description,
    brand_profile_zh: lead.brandProfileZh,
    product_categories: lead.productCategories,
    booth_venue: lead.boothVenue,
    booth_number: lead.boothNumber,
    booth_full: lead.boothFull,
    seek_funding: lead.seekFunding,
    funding_amount: lead.fundingAmount,
    revenue: lead.revenue,
    investment_stage: lead.investmentStage,
    opportunity_score: lead.opportunityScore,
    opportunity_tier: lead.opportunityTier as BrandLeadDto["opportunity_tier"],
    recommended_creator_profile: lead.recommendedCreatorProfile,
    campaign_angles: lead.campaignAngles,
    outreach_signals: lead.outreachSignals,
    converted_campaign_id: lead.convertedCampaignId,
    converted_at: lead.convertedAt?.toISOString() ?? null,
    created_at: lead.createdAt.toISOString(),
    updated_at: lead.updatedAt.toISOString(),
  };
}

export function createConvertedBrandSlug(name: string, leadId: string): string {
  const suffix =
    leadId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(-8) || "lead";
  const base =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "brand";
  return `${base}-${suffix}`;
}

export async function listBrandLeads(
  ctx: TenantCtx,
  params: BrandLeadListParams,
): Promise<{ items: BrandLeadDto[]; pagination: Pagination }> {
  const rows = await brandLeadRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(toDto), pagination };
}

export async function getBrandLead(ctx: TenantCtx, id: string): Promise<BrandLeadDto> {
  const lead = await brandLeadRepository.findById(ctx, id);
  if (!lead) throw new ApiError("RESOURCE_NOT_FOUND", "品牌线索不存在");
  return toDto(lead);
}

export async function upsertBrandLead(
  ctx: TenantCtx,
  input: BrandLeadCreateInput,
): Promise<BrandLeadDto> {
  const website = normalizeExternalUrl(input.website);
  const scoring = scoreBrandLead({
    productCategories: input.product_categories,
    country: input.country ?? null,
    description: input.description ?? null,
    website,
    seekFunding: input.seek_funding ?? null,
    fundingAmount: input.funding_amount ?? null,
    revenue: input.revenue ?? null,
    investmentStage: input.investment_stage ?? null,
  });
  const nameZh = generateChineseBrandName({
    name: input.name,
    categories: input.product_categories,
  });
  const campaignAngles =
    input.campaign_angles.length > 0 ? input.campaign_angles : scoring.campaignAngles;
  const outreachSignals =
    input.outreach_signals.length > 0 ? input.outreach_signals : scoring.outreachSignals;
  const brandProfileZh = generateChineseBrandProfile({
    name: input.name,
    nameZh,
    country: input.country ?? null,
    categories: input.product_categories,
    description: input.description ?? null,
    boothFull: input.booth_full ?? null,
    seekFunding: input.seek_funding ?? null,
    fundingAmount: input.funding_amount ?? null,
    investmentStage: input.investment_stage ?? null,
    campaignAngles,
    outreachSignals,
  });

  const lead = await brandLeadRepository.upsertBySource(ctx, {
    source: input.source,
    sourceId: input.source_id,
    name: input.name,
    nameZh,
    website,
    country: input.country ?? null,
    description: input.description ?? null,
    brandProfileZh,
    productCategories: input.product_categories,
    boothVenue: input.booth_venue ?? null,
    boothNumber: input.booth_number ?? null,
    boothFull: input.booth_full ?? null,
    seekFunding: input.seek_funding ?? null,
    fundingAmount: input.funding_amount ?? null,
    revenue: input.revenue ?? null,
    investmentStage: input.investment_stage ?? null,
    opportunityScore: input.opportunity_score ?? scoring.score,
    opportunityTier: input.opportunity_tier ?? scoring.tier,
    recommendedCreatorProfile:
      input.recommended_creator_profile ?? scoring.recommendedCreatorProfile,
    campaignAngles,
    outreachSignals,
    rawData: input.raw_data as Prisma.InputJsonValue,
  });
  return toDto(lead);
}

export async function getBrandLeadStats(ctx: TenantCtx): Promise<BrandLeadStatsDto> {
  const stats = await brandLeadRepository.stats(ctx);
  return {
    total: stats.total,
    priority: stats.priority,
    seeking_funding: stats.seekingFunding,
    countries: stats.countries,
    top_categories: stats.topCategories,
  };
}

export async function convertBrandLead(
  ctx: TenantCtx,
  id: string,
  input: BrandLeadConvertInput,
): Promise<BrandLeadConversionDto> {
  if (!ctx.userId) throw new ApiError("PERMISSION_DENIED", "需要登录用户才能转换品牌线索");
  const existing = await brandLeadRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "品牌线索不存在");

  const brandName = input.brand_name?.trim() || existing.nameZh || existing.name;
  const creativeDirection = input.creative_direction?.trim();
  const converted = await brandLeadRepository.convert(ctx, {
    leadId: id,
    existingBrandId: input.existing_brand_id ?? null,
    newBrand: input.existing_brand_id
      ? null
      : {
          name: brandName,
          slug: createConvertedBrandSlug(brandName, existing.id),
          description: input.brand_description?.trim() || null,
          markets: input.markets,
        },
    campaign: {
      name: input.campaign_name.trim(),
      objective: input.objective,
      markets: input.markets,
      platforms: input.platforms,
      goals: creativeDirection ? { notes: creativeDirection } : {},
    },
  });
  if (!converted) {
    if (input.existing_brand_id) {
      throw new ApiError("RESOURCE_NOT_FOUND", "所选品牌不存在或不属于当前组织");
    }
    throw new ApiError("CONFLICT", "品牌线索暂时无法转换，请重试");
  }
  return {
    brand_id: converted.brand.id,
    brand_name: converted.brand.name,
    campaign_id: converted.campaign.id,
    campaign_name: converted.campaign.name,
    already_converted: converted.alreadyConverted,
  };
}
