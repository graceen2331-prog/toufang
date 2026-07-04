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
