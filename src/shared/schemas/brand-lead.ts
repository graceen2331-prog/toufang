import { z } from "zod";
import { CAMPAIGN_OBJECTIVES } from "./campaign";

export const BRAND_LEAD_TIERS = ["priority", "nurture", "watch"] as const;

export const BRAND_LEAD_TIER_LABELS: Record<(typeof BRAND_LEAD_TIERS)[number], string> = {
  priority: "优先跟进",
  nurture: "培育观察",
  watch: "保持关注",
};

export const BRAND_LEAD_TIER_TONES: Record<(typeof BRAND_LEAD_TIERS)[number], string> = {
  priority: "success",
  nurture: "progress",
  watch: "neutral",
};

export const BrandLeadCreateSchema = z.object({
  source: z.string().min(1).max(50).default("manual"),
  source_id: z.string().min(1).max(100),
  name: z.string().min(1, "请输入品牌线索名称").max(200),
  website: z.string().max(500).nullish(),
  country: z.string().max(80).nullish(),
  description: z.string().max(5000).nullish(),
  product_categories: z.array(z.string()).default([]),
  booth_venue: z.string().max(200).nullish(),
  booth_number: z.string().max(80).nullish(),
  booth_full: z.string().max(300).nullish(),
  seek_funding: z.string().max(80).nullish(),
  funding_amount: z.string().max(120).nullish(),
  revenue: z.string().max(120).nullish(),
  investment_stage: z.string().max(120).nullish(),
  opportunity_score: z.number().int().min(0).max(100).optional(),
  opportunity_tier: z.enum(BRAND_LEAD_TIERS).optional(),
  recommended_creator_profile: z.string().max(1000).nullish(),
  campaign_angles: z.array(z.string()).default([]),
  outreach_signals: z.array(z.string()).default([]),
  raw_data: z.record(z.string(), z.unknown()).default({}),
});
export type BrandLeadCreateInput = z.infer<typeof BrandLeadCreateSchema>;

export const BrandLeadConvertSchema = z
  .object({
    existing_brand_id: z.string().min(1).nullish(),
    brand_name: z.string().min(1, "请输入品牌名称").max(100).nullish(),
    brand_description: z.string().max(2000).nullish(),
    campaign_name: z.string().min(1, "请输入 Campaign 名称").max(200),
    objective: z.enum(Object.keys(CAMPAIGN_OBJECTIVES) as [string, ...string[]]),
    markets: z.array(z.string().min(1).max(80)).default([]),
    platforms: z.array(z.string().min(1).max(50)).default([]),
    creative_direction: z.string().max(1000).nullish(),
  })
  .superRefine((input, ctx) => {
    if (!input.existing_brand_id && !input.brand_name?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["brand_name"],
        message: "创建新品牌时必须填写品牌名称",
      });
    }
  });
export type BrandLeadConvertInput = z.infer<typeof BrandLeadConvertSchema>;

export interface BrandLeadDto {
  id: string;
  source: string;
  source_id: string;
  name: string;
  name_zh: string | null;
  website: string | null;
  country: string | null;
  description: string | null;
  brand_profile_zh: string | null;
  product_categories: string[];
  booth_venue: string | null;
  booth_number: string | null;
  booth_full: string | null;
  seek_funding: string | null;
  funding_amount: string | null;
  revenue: string | null;
  investment_stage: string | null;
  opportunity_score: number;
  opportunity_tier: (typeof BRAND_LEAD_TIERS)[number];
  recommended_creator_profile: string | null;
  campaign_angles: string[];
  outreach_signals: string[];
  converted_campaign_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandLeadConversionDto {
  brand_id: string;
  brand_name: string;
  campaign_id: string;
  campaign_name: string;
  already_converted: boolean;
}

export interface BrandLeadStatsDto {
  total: number;
  priority: number;
  seeking_funding: number;
  countries: number;
  top_categories: Array<{ name: string; count: number }>;
}
