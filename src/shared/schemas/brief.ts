import { z } from "zod";

export const BriefContentSchema = z.object({
  title: z.string().min(1),
  background: z.string().default(""),
  product_positioning: z.string().default(""),
  key_messages: z.array(z.string()).default([]),
  must_include: z.array(z.string()).default([]),
  must_avoid: z.array(z.string()).default([]),
  cta: z.string().default(""),
  deliverables: z
    .array(z.object({ type: z.string(), count: z.number(), notes: z.string() }))
    .default([]),
  timeline_notes: z.string().default(""),
  platform_requirements: z
    .array(z.object({ platform: z.string(), requirements: z.array(z.string()) }))
    .default([]),
});
export type BriefContent = z.infer<typeof BriefContentSchema>;

export const BriefVersionCreateSchema = z.object({
  content: BriefContentSchema,
  change_summary: z.string().max(500).nullish(),
});

export const BriefStatusSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

export interface BriefVersionDto {
  id: string;
  version: number;
  content: BriefContent;
  plain_text: string;
  change_summary: string | null;
  ai_generated: boolean;
  model: string | null;
  prompt_key: string | null;
  prompt_version: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface BriefDto {
  id: string;
  campaign_id: string;
  title: string;
  status: string;
  current_version_id: string | null;
  current_version: BriefVersionDto | null;
  versions: Array<Pick<BriefVersionDto, "id" | "version" | "change_summary" | "ai_generated" | "created_at">>;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}
