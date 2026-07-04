import "server-only";
import type { ChatRequest, ChatResponse, ModelProvider } from "./types";

// 确定性假数据，按 promptKey 返回；测试/CI/演示用，不消耗 token
const FIXTURES: Record<string, unknown> = {
  "strategy.generate": {
    summary:
      "以「成分实证 + 场景种草」双线策略切入双十一大促周期：头部达人建立信任背书，腰部达人批量种草扩散，尾部素人晒单营造氛围。",
    objectives: ["大促期间品牌搜索量提升 50%", "站内转化 ROI 达到 2.5", "沉淀 30 条可复用素材"],
    platform_plan: [
      { platform: "douyin", budget_ratio: 0.55, content_focus: "成分讲解短视频 + 直播切片" },
      { platform: "xiaohongshu", budget_ratio: 0.45, content_focus: "测评笔记 + 前后对比图文" },
    ],
    creator_mix: [
      { tier: "头部（100 万+）", count: 2, budget_ratio: 0.4, role: "信任背书" },
      { tier: "腰部（10-100 万）", count: 8, budget_ratio: 0.45, role: "批量种草" },
      { tier: "尾部（1-10 万）", count: 20, budget_ratio: 0.15, role: "氛围晒单" },
    ],
    timeline: [
      { phase: "蓄水期", start_offset_days: 0, duration_days: 14, focus: "内容铺量与搜索优化" },
      { phase: "预热期", start_offset_days: 14, duration_days: 10, focus: "头部达人集中发布" },
      { phase: "爆发期", start_offset_days: 24, duration_days: 7, focus: "直播联动与投流放大" },
      { phase: "返场期", start_offset_days: 31, duration_days: 7, focus: "口碑二次传播" },
    ],
    kpi_suggestions: { impressions: 20000000, engagement_rate: 4.0, conversions: 15000, roi: 2.5 },
    risks: [
      { risk: "头部达人档期冲突", mitigation: "提前 6 周锁定档期并准备备选名单" },
      { risk: "功效表述合规风险", mitigation: "Brief 中明确禁用医疗类声明并要求初稿送审" },
    ],
  },
};

export const fakeProvider: ModelProvider = {
  name: "fake",

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const fixture = req.promptKey ? FIXTURES[req.promptKey] : null;
    const content = fixture
      ? JSON.stringify(fixture)
      : JSON.stringify({ note: `fake provider 无 ${req.promptKey ?? "unknown"} fixture` });
    return {
      content,
      usage: { inputTokens: 1200, outputTokens: 600 },
      model: "fake-model",
    };
  },

  async embed(texts: string[]) {
    // 基于文本 hash 的确定性伪向量（1536 维）
    const vectors = texts.map((text) => {
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h = Math.imul(h ^ text.charCodeAt(i), 16777619);
      }
      const vec = new Array<number>(1536);
      let x = h;
      for (let i = 0; i < 1536; i++) {
        x = Math.imul(x ^ (x >>> 15), 2246822507);
        vec[i] = ((x >>> 0) / 4294967296) * 2 - 1;
      }
      return vec;
    });
    return { vectors, usage: { inputTokens: texts.join("").length / 4, outputTokens: 0 } };
  },
};

/** 测试与演示可按需注册额外 fixture */
export function registerFakeFixture(promptKey: string, fixture: unknown): void {
  FIXTURES[promptKey] = fixture;
}
