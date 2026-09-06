import "server-only";
import { z } from "zod";
import type { PromptDefinition } from "./strategy";

export const ContentReviewOutputSchema = z.object({
  decision: z.enum(["approved", "needs_revision", "rejected"]),
  risk_level: z.enum(["low", "medium", "high"]),
  findings: z.array(
    z.object({
      type: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      quote: z.string().nullable(),
      issue: z.string(),
      suggestion: z.string(),
    }),
  ),
  creator_feedback: z.string(),
});
export type ContentReviewOutput = z.infer<typeof ContentReviewOutputSchema>;

export const ContentRewriteOutputSchema = z.object({
  revised_caption: z.string().nullable(),
  revised_transcript: z.string().nullable(),
  change_summary: z.array(z.string()),
  creator_message: z.string(),
});
export type ContentRewriteOutput = z.infer<typeof ContentRewriteOutputSchema>;

export const contentReviewPrompt: PromptDefinition<typeof ContentReviewOutputSchema> = {
  key: "content_review.evaluate",
  version: "v1",
  system: `你是品牌内容审核负责人，负责审阅达人内容初稿。

严格要求：
- 只依据输入里的 Brief、品牌规范、禁用词和平台规则判断，不得臆造不存在的要求。
- 修改建议必须具体、可执行、友好，能直接发给达人理解。
- 如发现任何 high 风险问题，risk_level 必须为 high，并必须进入人工复核；是否批准由人工审批最终决定。
- findings.quote 只摘录内容里的相关短句；没有原文时填 null。
- 输出必须是合法 JSON，结构为：{"decision":"approved|needs_revision|rejected","risk_level":"low|medium|high","findings":[{"type","severity","quote","issue","suggestion"}],"creator_feedback":string}。
- 所有文本使用中文。`,
  outputSchema: ContentReviewOutputSchema,
};

export const contentRewritePrompt: PromptDefinition<typeof ContentRewriteOutputSchema> = {
  key: "content_review.rewrite",
  version: "v1",
  system: `你是品牌内容编辑，负责把内容审核意见落实成可重新提交的达人内容修改稿。

严格要求：
- 只修改输入中已有的 caption / transcript；原本为 null 的字段输出 null。
- 必须逐条处理审核 findings 与人工反馈，删除或改写高风险表达。
- 不得新增 Brief、品牌规范或原内容里没有依据的功效承诺、价格政策、数据结论。
- 禁用词、绝对化用语、医疗化表达不得出现在修改稿中。
- 保留达人自然口吻，修改要具体、可发布，不要只输出修改建议。
- 输出必须是合法 JSON，结构为：{"revised_caption": string|null, "revised_transcript": string|null, "change_summary": string[], "creator_message": string}。
- 所有文本使用中文。`,
  outputSchema: ContentRewriteOutputSchema,
};
