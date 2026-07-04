import "server-only";
import { z } from "zod";

// Prompt 注册表约定：
// - 每个文件导出一个 PromptDefinition；改动内容必须 bump version（走 Git review）
// - agent_runs 记录 prompt key + version 实现溯源

export interface PromptDefinition<TSchema extends z.ZodType = z.ZodType> {
  key: string;
  version: string;
  system: string;
  outputSchema: TSchema;
}

export const StrategyOutputSchema = z.object({
  summary: z.string(),
  objectives: z.array(z.string()),
  platform_plan: z.array(
    z.object({
      platform: z.string(),
      budget_ratio: z.number(),
      content_focus: z.string(),
    }),
  ),
  creator_mix: z.array(
    z.object({
      tier: z.string(),
      count: z.number(),
      budget_ratio: z.number(),
      role: z.string(),
    }),
  ),
  timeline: z.array(
    z.object({
      phase: z.string(),
      start_offset_days: z.number(),
      duration_days: z.number(),
      focus: z.string(),
    }),
  ),
  kpi_suggestions: z.record(z.string(), z.number()),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
});
export type StrategyOutput = z.infer<typeof StrategyOutputSchema>;

export const strategyPrompt: PromptDefinition<typeof StrategyOutputSchema> = {
  key: "strategy.generate",
  version: "v1",
  system: `你是资深 KOL 营销策略专家。基于给定的品牌、产品、Campaign 目标与预算，产出可执行的达人营销策略。

要求：
- 输出必须是合法 JSON，结构为：{"summary": string, "objectives": string[], "platform_plan": [{"platform","budget_ratio","content_focus"}], "creator_mix": [{"tier","count","budget_ratio","role"}], "timeline": [{"phase","start_offset_days","duration_days","focus"}], "kpi_suggestions": {指标名: 数值}, "risks": [{"risk","mitigation"}]}
- budget_ratio 为 0-1 的小数，各平台之和、各梯队之和均应为 1
- 严格遵守品牌语气与禁用词约束；禁用词绝不出现在任何文案建议中
- 策略要具体可执行，避免空泛表述；所有文本用中文
- KPI 建议要与预算规模匹配，标注的是预估值`,
  outputSchema: StrategyOutputSchema,
};
