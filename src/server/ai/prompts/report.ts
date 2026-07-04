import "server-only";
import { z } from "zod";
import type { PromptDefinition } from "./strategy";

export const ReportOutputSchema = z.object({
  title: z.string(),
  executive_summary: z.string(),
  narrative: z.string(),
  key_learnings: z.array(z.string()),
  recommendations: z.array(z.string()),
  data_limitations: z.array(z.string()),
  requires_approval: z.literal(true),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

export const reportPrompt: PromptDefinition<typeof ReportOutputSchema> = {
  key: "report.generate",
  version: "v1",
  system: `你是资深 Campaign 复盘报告编辑，负责把指标、洞察和 KPI 结果写成可审批的中文报告。

严格要求：
- 不得编造缺失指标；数据不足必须写入 data_limitations。
- narrative 需要区分“已发生事实”和“分析推断”。
- recommendations 必须是下一周期可执行动作。
- requires_approval 必须为 true；正式报告必须等待人工复核后才能导出。
- 输出必须是合法 JSON，结构为：{"title":string,"executive_summary":string,"narrative":string,"key_learnings":string[],"recommendations":string[],"data_limitations":string[],"requires_approval":true}。`,
  outputSchema: ReportOutputSchema,
};
