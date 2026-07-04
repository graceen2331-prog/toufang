import "server-only";
import type { ChatRequest, ChatResponse, ModelProvider } from "./types";

// 确定性假数据，按 promptKey 返回；测试/CI/演示用，不消耗 token
const FIXTURES: Record<string, unknown> = {
  "research.generate": {
    market_overview:
      "功效护肤赛道在双十一周期竞争激烈，成分党内容渗透率持续上升，短视频测评与图文成分解析是转化效率最高的两类内容形式。",
    trends: [
      { title: "早C晚A 场景内容持续走热", detail: "组合护肤概念带动精华品类搜索，适合与达人共创使用教程类内容。" },
      { title: "皮肤屏障科普红利", detail: "皮肤科医生/配方师人设达人的信任度显著高于普通测评号。" },
    ],
    competitor_insights: [
      { competitor: "同价位竞品 A", insight: "以腰部达人矩阵铺量为主，头部投放少，评论区口碑维护较弱（推断）。" },
      { competitor: "国际大牌 B", insight: "预算集中在超头直播间，中小达人内容空间留白，可差异化切入。" },
    ],
    content_opportunities: ["28 天打卡实测系列", "成分浓度对比横评", "敏感肌真人测试"],
    risks: [
      { risk: "功效表述触碰广告法红线", severity: "high", mitigation: "Brief 明确禁用医疗功效词并要求初稿送审" },
      { risk: "大促期间达人档期紧张", severity: "medium", mitigation: "提前锁档 + 备选名单" },
    ],
    recommendations: ["优先锁定 2 位皮肤科背景头部达人", "腰部达人按 1:3 备选比例外联", "为爆文准备投流放大预算"],
  },
  "discovery.match": {
    matches: [
      { index: 0, match_score: 0.92, reasons: ["美妆护肤垂类高度契合", "互动率高于品类均值"], suggested_role: "hero", risk_notes: [] },
      { index: 1, match_score: 0.85, reasons: ["成分党内容风格与品牌调性一致"], suggested_role: "amplifier", risk_notes: [] },
      { index: 2, match_score: 0.78, reasons: ["受众年龄与目标人群重合度高"], suggested_role: "amplifier", risk_notes: ["近期数据波动较大"] },
      { index: 3, match_score: 0.72, reasons: ["性价比高，适合批量种草"], suggested_role: "seeder", risk_notes: [] },
      { index: 4, match_score: 0.65, reasons: ["内容质量稳定"], suggested_role: "seeder", risk_notes: [] },
    ],
  },
  "scoring.evaluate": {
    scores: [
      {
        index: 0, overall_score: 88, tier: "S",
        dimensions: { brand_fit: 92, audience_fit: 90, content_fit: 88, engagement: 85, cost_efficiency: 78, estimated_roi: 86 },
        risk: { level: "low", flags: [] },
        explanation: "垂类契合度与互动质量俱佳，建议作为头部背书优先锁定。", shortlist: true,
      },
      {
        index: 1, overall_score: 76, tier: "A",
        dimensions: { brand_fit: 80, audience_fit: 78, content_fit: 82, engagement: 72, cost_efficiency: 75, estimated_roi: 70 },
        risk: { level: "low", flags: [] },
        explanation: "内容风格稳定，报价合理，适合作为腰部主力。", shortlist: true,
      },
      {
        index: 2, overall_score: 62, tier: "B",
        dimensions: { brand_fit: 70, audience_fit: 65, content_fit: 60, engagement: 55, cost_efficiency: 68, estimated_roi: 55 },
        risk: { level: "medium", flags: ["近 30 天互动率下滑"] },
        explanation: "数据近期波动，建议观察一周期或压价合作。", shortlist: false,
      },
    ],
  },
  "brief.generate": {
    title: "焕亮维C精华 双十一种草 Brief",
    background: "双十一大促周期，以成分实证建立信任，推动精华品类转化。",
    product_positioning: "15% VC 衍生物复配烟酰胺的功效型提亮精华，主打温和不刺激。",
    key_messages: ["28 天可见提亮（附实测）", "成分浓度透明公开", "敏感肌友好配方"],
    must_include: ["产品全名", "核心成分与浓度", "大促机制口播", "指定话题标签"],
    must_avoid: ["最强", "第一", "治愈", "医疗级", "药用", "祛斑功效声明", "医疗功效暗示"],
    cta: "点击购物车领取双十一专属优惠",
    deliverables: [
      { type: "短视频", count: 1, notes: "60-90 秒，前 3 秒钩子突出实测对比" },
      { type: "图文笔记", count: 1, notes: "成分解析向，附 28 天打卡记录" },
    ],
    timeline_notes: "初稿提交后 48 小时内完成审核；发布须在预热期窗口内。",
    platform_requirements: [
      { platform: "douyin", requirements: ["挂购物车", "添加指定话题", "露出品牌官方账号"] },
      { platform: "xiaohongshu", requirements: ["报备笔记", "添加品牌话题", "禁止外链导流"] },
    ],
  },
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
