import { z } from "zod";

export const PLATFORMS = [
  "douyin",
  "xiaohongshu",
  "bilibili",
  "weibo",
  "kuaishou",
  "tiktok",
  "instagram",
  "youtube",
] as const;

export const PLATFORM_LABELS: Record<(typeof PLATFORMS)[number], string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  bilibili: "B站",
  weibo: "微博",
  kuaishou: "快手",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

export const ContactInfoSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  wechat: z.string().optional(),
  agent_name: z.string().optional(),
  agent_contact: z.string().optional(),
});
export type ContactInfo = z.infer<typeof ContactInfoSchema>;

export const CreatorCreateSchema = z.object({
  display_name: z.string().min(1, "请输入达人名称").max(100),
  bio: z.string().max(2000).nullish(),
  country: z.string().max(50).nullish(),
  languages: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  contact_info: ContactInfoSchema.default({}),
});
export type CreatorCreateInput = z.infer<typeof CreatorCreateSchema>;

export const CreatorUpdateSchema = CreatorCreateSchema.partial().extend({
  risk_level: z.enum(["unknown", "low", "medium", "high"]).optional(),
});
export type CreatorUpdateInput = z.infer<typeof CreatorUpdateSchema>;

export const CreatorStatusSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

export const PlatformAccountSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1, "请输入账号").max(100),
  url: z.string().url("链接格式不正确").nullish().or(z.literal("")),
  followers: z.number("请输入粉丝数").int().nonnegative(),
  engagement_rate: z.number("请输入互动率").nonnegative().max(100),
  avg_views: z.number("请输入平均播放").int().nonnegative(),
});
export type PlatformAccountInput = z.infer<typeof PlatformAccountSchema>;

export const CreatorNoteSchema = z.object({
  content: z.string().min(1, "请输入笔记内容").max(5000),
});

export interface PlatformAccountDto {
  id: string;
  platform: string;
  handle: string;
  url: string | null;
  followers: number;
  engagement_rate: number;
  avg_views: number;
}

export interface CreatorListItemDto {
  id: string;
  display_name: string;
  relationship_status: string;
  risk_level: string;
  country: string | null;
  categories: string[];
  tags: string[];
  total_followers: number;
  max_engagement_rate: number;
  platforms: string[];
  created_at: string;
}

export interface CreatorDetailDto {
  id: string;
  display_name: string;
  bio: string | null;
  profile_summary: string | null;
  relationship_status: string;
  risk_level: string;
  country: string | null;
  languages: string[];
  categories: string[];
  tags: string[];
  source: string;
  has_contact_info: boolean;
  platform_accounts: PlatformAccountDto[];
  latest_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorNoteDto {
  id: string;
  content: string;
  created_by_name: string | null;
  created_at: string;
}
