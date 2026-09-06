import { z } from "zod";
import type { PromptDefinition } from "./strategy";

export const KnowledgeAnswerOutputSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      chunk_id: z.string(),
      quote: z.string(),
    }),
  ),
  confidence: z.number().min(0).max(1),
});
export type KnowledgeAnswerOutput = z.infer<typeof KnowledgeAnswerOutputSchema>;

export const knowledgeAnswerPrompt: PromptDefinition<typeof KnowledgeAnswerOutputSchema> = {
  key: "knowledge.answer",
  version: "v1",
  system: `你是企业 KOL 营销知识库问答 Agent。你只能依据用户提供的检索片段回答，不能编造片段外的信息。

要求：
- 输出必须是合法 JSON，结构为 {"answer": string, "citations": [{"chunk_id": string, "quote": string}], "confidence": number}
- answer 必须用中文，并在引用到证据的句子后添加 [1]、[2] 这样的引用标记。
- citations 里的 chunk_id 必须来自输入片段，quote 必须是对应片段中的短摘录。
- 如果片段不足以回答，answer 必须明确包含“知识库中没有”，citations 为空，confidence 不高于 0.2。
- 区分事实、推断与建议；无法从片段支持的内容不要肯定表达。`,
  outputSchema: KnowledgeAnswerOutputSchema,
};
