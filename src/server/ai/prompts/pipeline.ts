import "server-only";
import { z } from "zod";
import type { PromptDefinition } from "./strategy";

export const ResearchOutputSchema = z.object({
  market_overview: z.string(),
  trends: z.array(z.object({ title: z.string(), detail: z.string() })),
  competitor_insights: z.array(z.object({ competitor: z.string(), insight: z.string() })),
  content_opportunities: z.array(z.string()),
  risks: z.array(z.object({ risk: z.string(), severity: z.enum(["low", "medium", "high"]), mitigation: z.string() })),
  recommendations: z.array(z.string()),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

export const researchPrompt: PromptDefinition<typeof ResearchOutputSchema> = {
  key: "research.generate",
  version: "v1",
  system: `你是 KOL 营销市场研究专家。基于品牌、产品与 Campaign 信息，输出结构化市场研究。

输出 JSON 结构：{"market_overview": string, "trends": [{"title","detail"}], "competitor_insights": [{"competitor","insight"}], "content_opportunities": string[], "risks": [{"risk","severity":"low|medium|high","mitigation"}], "recommendations": string[]}

要求：
- 研究要落到 KOL 投放决策上（内容形式、平台选择、达人类型），不要泛泛的行业报告
- 竞品洞察聚焦其达人投放打法；没有明确竞品信息时基于品类常识推断并注明是推断
- 全部中文，输出仅 JSON`,
  outputSchema: ResearchOutputSchema,
};

// 发现与评分的 agent 输出用候选列表的 index（不是 creator_id），
// 由代码侧映射回真实 ID —— 同时保证 fake fixture 可用
export const DiscoveryOutputSchema = z.object({
  matches: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      match_score: z.number().min(0).max(1),
      reasons: z.array(z.string()),
      suggested_role: z.enum(["hero", "amplifier", "seeder"]),
      risk_notes: z.array(z.string()),
    }),
  ),
});
export type DiscoveryOutput = z.infer<typeof DiscoveryOutputSchema>;

export const discoveryPrompt: PromptDefinition<typeof DiscoveryOutputSchema> = {
  key: "discovery.match",
  version: "v1",
  system: `你是达人匹配专家。给定 Campaign 策略与候选达人列表（含编号 index），为每位值得推荐的达人打匹配分并说明理由。

输出 JSON：{"matches": [{"index": 候选列表中的编号, "match_score": 0到1, "reasons": string[], "suggested_role": "hero|amplifier|seeder", "risk_notes": string[]}]}

要求：
- 只输出值得进入候选池的达人（匹配分 < 0.4 的直接不输出）
- 理由要具体引用达人的分类/粉丝量/互动率与策略的匹配点
- hero=信任背书的头部，amplifier=放大声量的腰部，seeder=氛围种草的尾部
- 全部中文，输出仅 JSON`,
  outputSchema: DiscoveryOutputSchema,
};

export const ScoringOutputSchema = z.object({
  scores: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      overall_score: z.number().min(0).max(100),
      tier: z.enum(["S", "A", "B", "C"]),
      dimensions: z.object({
        brand_fit: z.number().min(0).max(100),
        audience_fit: z.number().min(0).max(100),
        content_fit: z.number().min(0).max(100),
        engagement: z.number().min(0).max(100),
        cost_efficiency: z.number().min(0).max(100),
        estimated_roi: z.number().min(0).max(100),
      }),
      risk: z.object({
        level: z.enum(["low", "medium", "high"]),
        flags: z.array(z.string()),
      }),
      explanation: z.string(),
      shortlist: z.boolean(),
    }),
  ),
});
export type ScoringOutput = z.infer<typeof ScoringOutputSchema>;

export const scoringPrompt: PromptDefinition<typeof ScoringOutputSchema> = {
  key: "scoring.evaluate",
  version: "v1",
  system: `你是达人评估专家。对候选达人做六维评分（品牌契合/受众契合/内容契合/互动质量/成本效率/预估 ROI），并给出是否建议入围（shortlist）。

输出 JSON：{"scores": [{"index", "overall_score": 0-100, "tier": "S|A|B|C", "dimensions": {"brand_fit","audience_fit","content_fit","engagement","cost_efficiency","estimated_roi"}, "risk": {"level":"low|medium|high","flags": string[]}, "explanation", "shortlist": boolean}]}

要求：
- overall_score 为六维加权综合；S≥85, A≥70, B≥55, C<55
- 高风险达人即使分高也要在 explanation 中明确提示
- explanation 是给运营看的一句话结论，具体可执行
- 全部中文，输出仅 JSON`,
  outputSchema: ScoringOutputSchema,
};

export const BriefOutputSchema = z.object({
  title: z.string(),
  background: z.string(),
  product_positioning: z.string(),
  key_messages: z.array(z.string()),
  must_include: z.array(z.string()),
  must_avoid: z.array(z.string()),
  cta: z.string(),
  deliverables: z.array(z.object({ type: z.string(), count: z.number(), notes: z.string() })),
  timeline_notes: z.string(),
  platform_requirements: z.array(z.object({ platform: z.string(), requirements: z.array(z.string()) })),
});
export type BriefOutput = z.infer<typeof BriefOutputSchema>;

export const briefPrompt: PromptDefinition<typeof BriefOutputSchema> = {
  key: "brief.generate",
  version: "v1",
  system: `你是内容 Brief 专家。基于 Campaign 策略、品牌规范与产品信息，产出达人可直接执行的内容 Brief。

输出 JSON：{"title", "background", "product_positioning", "key_messages": string[], "must_include": string[], "must_avoid": string[], "cta", "deliverables": [{"type","count","notes"}], "timeline_notes", "platform_requirements": [{"platform","requirements": string[]}]}

要求：
- must_avoid 必须完整包含品牌禁用词与产品禁止声明，并补充平台合规要求
- key_messages 从产品核心卖点提炼，符合品牌语气
- deliverables 与策略的达人组合/平台规划呼应
- 全部中文，输出仅 JSON`,
  outputSchema: BriefOutputSchema,
};
