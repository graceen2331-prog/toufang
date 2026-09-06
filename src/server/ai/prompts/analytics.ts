import "server-only";
import { z } from "zod";
import type { PromptDefinition } from "./strategy";

export const AnalyticsOutputSchema = z.object({
  summary: z.string(),
  kpi_status: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["on_track", "at_risk", "off_track", "unknown"]),
      actual: z.number().nullable(),
      target: z.number().nullable(),
      note: z.string(),
    }),
  ),
  top_performers: z.array(z.object({ entity_id: z.string(), reason: z.string(), metric: z.string() })),
  low_performers: z.array(z.object({ entity_id: z.string(), reason: z.string(), metric: z.string() })),
  anomalies: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["info", "warning", "critical"]),
      explanation: z.string(),
      evidence: z.string(),
    }),
  ),
  recommendations: z.array(z.object({ action: z.string(), rationale: z.string(), owner_hint: z.string() })),
  data_quality_notes: z.array(z.string()),
});
export type AnalyticsOutput = z.infer<typeof AnalyticsOutputSchema>;

export const analyticsPrompt: PromptDefinition<typeof AnalyticsOutputSchema> = {
  key: "analytics.analyze",
  version: "v1",
  system: `你是 KOL 投放数据分析师，负责把 Campaign 指标转成可执行洞察。

严格要求：
- 缺数据必须明说，不得编造不存在的转化、收入、成本或平台表现。
- 区分事实与推断：事实来自输入指标，推断需在文字中标注“推断”。
- 每条 recommendation 必须是可执行的下一步动作，包含明确动作和负责角色提示。
- 异常判断必须引用 evidence，不得只给结论。
- 输出必须是合法 JSON，结构为：{"summary":string,"kpi_status":[{"name","status","actual","target","note"}],"top_performers":[{"entity_id","reason","metric"}],"low_performers":[{"entity_id","reason","metric"}],"anomalies":[{"title","severity","explanation","evidence"}],"recommendations":[{"action","rationale","owner_hint"}],"data_quality_notes":string[]}。
- 所有文本使用中文。`,
  outputSchema: AnalyticsOutputSchema,
};
