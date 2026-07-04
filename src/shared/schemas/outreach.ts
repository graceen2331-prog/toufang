import { z } from "zod";

export const OutreachThreadCreateSchema = z.object({
  campaign_creator_id: z.string().min(1),
  channel: z.enum(["email", "dm_manual"]).default("email"),
  subject: z.string().max(300).nullish(),
});

export const OutreachDraftRequestSchema = z.object({
  /** 追加给 AI 的指示（可选），如"语气更正式一点" */
  instruction: z.string().max(500).nullish(),
});

export const OutreachMessageCreateSchema = z.object({
  direction: z.enum(["outbound", "inbound"]).default("outbound"),
  subject: z.string().max(300).nullish(),
  body: z.string().min(1, "请输入消息内容").max(10000),
});

export const OutreachMessageStatusSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

export const NegotiationAnalyzeSchema = z.object({
  /** 达人回复原文（inbound 消息 id 或直接文本二选一） */
  reply_message_id: z.string().nullish(),
  reply_text: z.string().max(10000).nullish(),
  quoted_price_cents: z.number().int().nonnegative().nullish(),
});

export const AgreedTermsSchema = z.object({
  agreed_price_cents: z.number().int().nonnegative(),
  deliverables: z.array(z.string()).default([]),
  usage_rights: z.string().max(1000).nullish(),
  payment_terms: z.string().max(1000).nullish(),
  notes: z.string().max(2000).nullish(),
});

// ---- 合同与付款 ----

export const ContractCreateSchema = z.object({
  campaign_creator_id: z.string().min(1),
  amount_cents: z.number().int().nonnegative(),
  usage_rights: z.string().max(2000).nullish(),
  exclusivity_terms: z.string().max(2000).nullish(),
  payment_terms: z.string().max(2000).nullish(),
});

export const ContractStatusChangeSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

export const PaymentCreateSchema = z.object({
  contract_id: z.string().min(1),
  amount_cents: z.number().int().positive(),
  method: z.enum(["bank", "alipay", "other"]).nullish(),
  notes: z.string().max(1000).nullish(),
});

export const PaymentStatusChangeSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

// ---- DTO ----

export interface OutreachThreadListItemDto {
  id: string;
  campaign_creator_id: string;
  campaign_id: string;
  campaign_name: string;
  creator_id: string;
  creator_name: string;
  channel: string;
  status: string;
  subject: string | null;
  message_count: number;
  last_message_at: string | null;
  has_pending_approval: boolean;
  created_at: string;
}

export interface OutreachMessageDto {
  id: string;
  direction: string;
  status: string;
  approval_status: string;
  subject: string | null;
  body: string;
  reply_intent: string | null;
  ai_generated: boolean;
  model: string | null;
  prompt_key: string | null;
  prompt_version: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface NegotiationRecordDto {
  id: string;
  status: string;
  quoted_price_cents: number | null;
  counter_price_cents: number | null;
  agreed_price_cents: number | null;
  intent: string | null;
  intent_summary: string | null;
  pricing_analysis: Record<string, unknown>;
  strategy: string[];
  reply_draft: string | null;
  required_approvals: string[];
  risk_notes: string[];
  agreed_terms: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OutreachThreadDetailDto extends OutreachThreadListItemDto {
  messages: OutreachMessageDto[];
  negotiations: NegotiationRecordDto[];
  campaign_creator_status: string;
  budget_remaining_cents: number | null;
}

export interface ContractDto {
  id: string;
  campaign_creator_id: string;
  campaign_name: string;
  creator_name: string;
  contract_number: string;
  status: string;
  version: number;
  amount_cents: number;
  currency: string;
  usage_rights: string | null;
  exclusivity_terms: string | null;
  payment_terms: string | null;
  signed_at: string | null;
  payment_total_cents: number;
  payment_paid_cents: number;
  created_at: string;
}

export interface PaymentDto {
  id: string;
  contract_id: string;
  contract_number: string;
  creator_name: string;
  status: string;
  amount_cents: number;
  currency: string;
  method: string | null;
  notes: string | null;
  paid_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export const THREAD_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  open: { label: "进行中", tone: "info" },
  replied: { label: "已回复", tone: "progress" },
  negotiating: { label: "谈判中", tone: "progress" },
  closed_won: { label: "达成合作", tone: "success" },
  closed_lost: { label: "未达成", tone: "danger" },
  no_response: { label: "无回应", tone: "warning" },
};

export const REPLY_INTENT_LABELS: Record<string, string> = {
  interested: "有意向",
  reject: "婉拒",
  negotiate: "谈判中",
  need_info: "需要更多信息",
  irrelevant: "无关回复",
};
