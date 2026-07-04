import { z } from "zod";

export const BrandCreateSchema = z.object({
  name: z.string().min(1, "请输入品牌名称").max(100),
  slug: z
    .string()
    .min(1, "请输入品牌标识")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "标识只能包含小写字母、数字和连字符"),
  description: z.string().max(2000).nullish(),
  industry: z.string().max(100).nullish(),
  markets: z.array(z.string()).default([]),
  guidelines: z
    .object({
      tone: z.string().optional(),
      voice: z.string().optional(),
      visual: z.string().optional(),
      notes: z.string().optional(),
    })
    .default({}),
  restricted_terms: z.array(z.string()).default([]),
});
export type BrandCreateInput = z.infer<typeof BrandCreateSchema>;

export const BrandUpdateSchema = BrandCreateSchema.partial().omit({ slug: true });
export type BrandUpdateInput = z.infer<typeof BrandUpdateSchema>;

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string | null;
  markets: string[];
  guidelines: Record<string, string>;
  restricted_terms: string[];
  product_count?: number;
  created_at: string;
  updated_at: string;
}
