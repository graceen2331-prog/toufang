import { z } from "zod";

export const ProductCreateSchema = z.object({
  brand_id: z.string().min(1, "请选择品牌"),
  name: z.string().min(1, "请输入产品名称").max(100),
  description: z.string().max(2000).nullish(),
  category: z.string().max(100).nullish(),
  price: z
    .object({
      amount: z.number().nonnegative().optional(),
      currency: z.string().default("CNY").optional(),
    })
    .default({}),
  key_claims: z.array(z.string()).default([]),
  restricted_claims: z.array(z.string()).default([]),
  links: z.array(z.string()).default([]),
});
export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;

export const ProductUpdateSchema = ProductCreateSchema.partial().omit({ brand_id: true });
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

export interface ProductDto {
  id: string;
  brand_id: string;
  brand_name?: string;
  name: string;
  description: string | null;
  category: string | null;
  price: { amount?: number; currency?: string };
  key_claims: string[];
  restricted_claims: string[];
  links: string[];
  created_at: string;
  updated_at: string;
}
