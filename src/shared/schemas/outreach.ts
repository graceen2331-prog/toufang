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

export const PaymentCreateSchema = z
  .object({
    request_key: z.string().uuid(),
    amount_cents: z.number().int().positive(),
    currency: z.literal("CNY"),
    method: z.enum(["bank", "alipay", "other"]),
    milestone_key: z.string().min(1).max(100),
    milestone_label: z.string().min(1).max(200),
    payee: z.object({
      name: z.string().min(1).max(200),
      bank_name: z.string().min(1).max(200),
      account_number: z.string().min(4).max(100),
    }),
    invoice: z.object({
      number: z.string().max(100).nullish(),
      issuer: z.string().max(200).nullish(),
      amount_cents: z.number().int().positive().nullish(),
      currency: z.literal("CNY").nullish(),
      exception_reason: z.string().max(500).nullish(),
    }),
    notes: z.string().max(1000).nullish(),
  })
  .superRefine((input, ctx) => {
    const hasInvoice = Boolean(input.invoice.number?.trim() && input.invoice.issuer?.trim());
    const hasException = Boolean(input.invoice.exception_reason?.trim());
    if (!hasInvoice && !hasException) {
      ctx.addIssue({
        code: "custom",
        path: ["invoice", "exception_reason"],
        message: "请填写发票号码和开票方，或说明免票原因",
      });
    }
    if (hasInvoice && hasException) {
      ctx.addIssue({
        code: "custom",
        path: ["invoice", "exception_reason"],
        message: "发票信息和免票原因只能选择一种",
      });
    }
    if (hasInvoice && input.invoice.amount_cents == null) {
      ctx.addIssue({
        code: "custom",
        path: ["invoice", "amount_cents"],
        message: "请填写发票金额",
      });
    }
    if (
      hasInvoice &&
      input.invoice.amount_cents != null &&
      input.invoice.amount_cents < input.amount_cents
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["invoice", "amount_cents"],
        message: "发票金额不能低于本次付款金额",
      });
    }
    if (hasInvoice && input.invoice.currency !== input.currency) {
      ctx.addIssue({
        code: "custom",
        path: ["invoice", "currency"],
        message: "发票币种必须与付款币种一致",
      });
    }
  });
export type PaymentCreateInput = z.infer<typeof PaymentCreateSchema>;

export const PaymentStatusChangeSchema = z.object({
  to: z.string().min(1),
  reason: z.string().max(500).nullish(),
});

export const PaymentReconcileSchema = z.object({
  settlement_request_key: z.string().uuid(),
  reconciliation_reference: z.string().min(4).max(200),
  paid_at: z.string().datetime(),
  evidence_note: z.string().min(10).max(1000),
  evidence_document_ref: z.string().max(500).nullish(),
});
export type PaymentReconcileInput = z.infer<typeof PaymentReconcileSchema>;

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

export interface OutreachCandidateDto {
  campaign_creator_id: string;
  campaign_id: string;
  creator_id: string;
  creator_name: string;
  status: string;
  role: string | null;
  quoted_price_cents: number | null;
  agreed_price_cents: number | null;
  can_create_thread: boolean;
  blocked_reason: string | null;
  existing_thread_id: string | null;
  existing_thread_status: string | null;
  existing_thread_subject: string | null;
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
  version: number;
  milestone_key: string | null;
  milestone_label: string | null;
  payee_name: string | null;
  payee_bank_name: string | null;
  payee_account_last4: string | null;
  invoice_number: string | null;
  invoice_issuer: string | null;
  invoice_exception_reason: string | null;
  approval_checkpoint_id: string | null;
  approval_snapshot_hash: string | null;
  reconciliation_reference: string | null;
  reconciliation_evidence_present: boolean;
  paid_by: string | null;
  legacy_evidence_incomplete: boolean;
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
