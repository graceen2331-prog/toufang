import { z } from "zod";

export const CAMPAIGN_OBJECTIVES = {
  awareness: "品牌曝光",
  engagement: "互动种草",
  conversion: "转化销售",
  launch: "新品发布",
  longterm: "长期心智",
} as const;

export const CampaignCreateSchema = z.object({
  name: z.string().min(1, "请输入 Campaign 名称").max(200),
  brand_id: z.string().min(1, "请选择品牌"),
  product_id: z.string().nullish(),
  objective: z.enum(Object.keys(CAMPAIGN_OBJECTIVES) as [string, ...string[]]).nullish(),
  markets: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
  budget_total_cents: z.number().int().nonnegative().default(0),
  currency: z.string().default("CNY"),
  goals: z
    .object({
      impressions: z.number().optional(),
      engagement: z.number().optional(),
      clicks: z.number().optional(),
      conversions: z.number().optional(),
      roi: z.number().optional(),
      notes: z.string().optional(),
    })
    .default({}),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
});
export type CampaignCreateInput = z.infer<typeof CampaignCreateSchema>;

export const CampaignUpdateSchema = CampaignCreateSchema.partial().omit({ brand_id: true });
export type CampaignUpdateInput = z.infer<typeof CampaignUpdateSchema>;

export const CampaignStatusSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

export const CampaignCreatorAddSchema = z.object({
  creator_ids: z.array(z.string().min(1)).min(1, "至少选择一位达人"),
  role: z.enum(["hero", "amplifier", "seeder"]).nullish(),
});

export const CampaignCreatorStatusSchema = z.object({
  to: z.string().min(1),
  /** 缺省推进主状态；传入则推进对应子状态 */
  field: z.enum(["status", "contract_status", "payment_status", "content_status"]).default("status"),
  reason: z.string().max(500).nullish(),
});

export const CampaignTaskSchema = z.object({
  title: z.string().min(1, "请输入任务标题").max(200),
  description: z.string().max(2000).nullish(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assignee_id: z.string().nullish(),
  due_at: z.string().nullish(),
});
export type CampaignTaskInput = z.infer<typeof CampaignTaskSchema>;

export const CampaignTaskUpdateSchema = CampaignTaskSchema.partial().extend({
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
});

export const BudgetItemSchema = z.object({
  category: z.enum(["creator_fee", "production", "media", "other"]),
  name: z.string().min(1, "请输入预算项名称").max(200),
  planned_cents: z.number().int().nonnegative().default(0),
  reserved_cents: z.number().int().nonnegative().default(0),
  spent_cents: z.number().int().nonnegative().default(0),
});
export type BudgetItemInput = z.infer<typeof BudgetItemSchema>;

// ---- DTO ----

export interface CampaignListItemDto {
  id: string;
  name: string;
  status: string;
  health_status: string;
  brand_id: string;
  brand_name: string;
  objective: string | null;
  platforms: string[];
  budget_total_cents: number;
  currency: string;
  creator_count: number;
  owner_name: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface CampaignDetailDto extends CampaignListItemDto {
  product_id: string | null;
  product_name: string | null;
  markets: string[];
  goals: Record<string, number | string>;
  budget_used_cents: number;
  task_open_count: number;
  updated_at: string;
}

export interface CampaignCreatorDto {
  id: string;
  creator_id: string;
  creator_name: string;
  status: string;
  contract_status: string;
  payment_status: string;
  content_status: string;
  role: string | null;
  match_score: number | null;
  quoted_price_cents: number | null;
  agreed_price_cents: number | null;
  ai_generated: boolean;
  created_at: string;
}

export interface CampaignTaskDto {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_at: string | null;
  created_at: string;
}

export interface BudgetItemDto {
  id: string;
  category: string;
  name: string;
  planned_cents: number;
  reserved_cents: number;
  spent_cents: number;
  related_type: string | null;
  related_id: string | null;
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "待办",
  in_progress: "进行中",
  done: "已完成",
  cancelled: "已取消",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

export const BUDGET_CATEGORY_LABELS: Record<string, string> = {
  creator_fee: "达人费用",
  production: "制作费用",
  media: "投流费用",
  other: "其他",
};
