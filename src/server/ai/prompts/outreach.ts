import "server-only";
import { z } from "zod";
import type { PromptDefinition } from "./strategy";

export const OutreachOutputSchema = z.object({
  subject: z.string(),
  body: z.string(),
  personalization_points: z.array(z.string()),
  tone_notes: z.string(),
  risk_notes: z.array(z.string()),
});
export type OutreachOutput = z.infer<typeof OutreachOutputSchema>;

export const outreachPrompt: PromptDefinition<typeof OutreachOutputSchema> = {
  key: "outreach.draft",
  version: "v1",
  system: `你是达人外联专家。基于 Campaign、品牌、Brief 与达人画像，起草个性化外联消息（首次触达或跟进）。

输出 JSON：{"subject": 邮件主题, "body": 正文, "personalization_points": string[], "tone_notes": 语气说明, "risk_notes": string[]}

要求：
- 正文 150-300 字，开头用达人的具体内容/风格做个性化切入（引用 personalization_points）
- 明确合作意向与产品，但首次触达不报价
- 符合品牌语气；绝不使用品牌禁用词
- 正文以中文书写，落款用 Campaign 品牌方名义
- 输出仅 JSON`,
  outputSchema: OutreachOutputSchema,
};

export const NegotiationOutputSchema = z.object({
  intent: z.enum(["interested", "reject", "negotiate", "need_info", "irrelevant"]),
  intent_summary: z.string(),
  pricing_analysis: z.object({
    quoted_price_assessment: z.string(),
    market_reference: z.string(),
    suggested_counter_cents: z.number().nullable(),
    walk_away_cents: z.number().nullable(),
  }),
  strategy: z.array(z.string()),
  reply_draft: z.string(),
  required_approvals: z.array(z.string()),
  risk_notes: z.array(z.string()),
});
export type NegotiationOutput = z.infer<typeof NegotiationOutputSchema>;

export const negotiationPrompt: PromptDefinition<typeof NegotiationOutputSchema> = {
  key: "negotiation.analyze",
  version: "v1",
  system: `你是达人商务谈判专家。基于达人回复、报价与 Campaign 预算，分析意图并给出谈判策略与回复草稿。

输出 JSON：{"intent": "interested|reject|negotiate|need_info|irrelevant", "intent_summary": string, "pricing_analysis": {"quoted_price_assessment", "market_reference", "suggested_counter_cents": number|null, "walk_away_cents": number|null}, "strategy": string[], "reply_draft": string, "required_approvals": string[], "risk_notes": string[]}

要求：
- 报价评估要对比达人量级的市场常见价（CPM 口径），说明高/合理/低
- suggested_counter_cents 是建议还价（分）；报价合理时可为 null
- 超出预算或涉及独家授权/长期约时，required_approvals 中列出需要的审批（如"预算上调审批"）
- reply_draft 用中文，语气专业友好，不做最终承诺
- 输出仅 JSON`,
  outputSchema: NegotiationOutputSchema,
};
