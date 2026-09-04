import "server-only";
import type { ChatRequest, ChatResponse, ModelProvider } from "./types";

// 确定性假数据，按 promptKey 返回；测试/CI/演示用，不消耗 token
const FIXTURES: Record<string, unknown> = {
  "settings.test": {
    ok: true,
    message: "fake provider 已连通",
  },
  "research.generate": {
    market_overview:
      "功效护肤赛道在双十一周期竞争激烈，成分党内容渗透率持续上升，短视频测评与图文成分解析是转化效率最高的两类内容形式。",
    trends: [
      {
        title: "早C晚A 场景内容持续走热",
        detail: "组合护肤概念带动精华品类搜索，适合与达人共创使用教程类内容。",
      },
      {
        title: "皮肤屏障科普红利",
        detail: "皮肤科医生/配方师人设达人的信任度显著高于普通测评号。",
      },
    ],
    competitor_insights: [
      {
        competitor: "同价位竞品 A",
        insight: "以腰部达人矩阵铺量为主，头部投放少，评论区口碑维护较弱（推断）。",
      },
      {
        competitor: "国际大牌 B",
        insight: "预算集中在超头直播间，中小达人内容空间留白，可差异化切入。",
      },
    ],
    content_opportunities: ["28 天打卡实测系列", "成分浓度对比横评", "敏感肌真人测试"],
    risks: [
      {
        risk: "功效表述触碰广告法红线",
        severity: "high",
        mitigation: "Brief 明确禁用医疗功效词并要求初稿送审",
      },
      { risk: "大促期间达人档期紧张", severity: "medium", mitigation: "提前锁档 + 备选名单" },
    ],
    recommendations: [
      "优先锁定 2 位皮肤科背景头部达人",
      "腰部达人按 1:3 备选比例外联",
      "为爆文准备投流放大预算",
    ],
  },
  "discovery.match": {
    matches: [
      {
        index: 0,
        match_score: 0.92,
        reasons: ["美妆护肤垂类高度契合", "互动率高于品类均值"],
        suggested_role: "hero",
        risk_notes: [],
      },
      {
        index: 1,
        match_score: 0.85,
        reasons: ["成分党内容风格与品牌调性一致"],
        suggested_role: "amplifier",
        risk_notes: [],
      },
      {
        index: 2,
        match_score: 0.78,
        reasons: ["受众年龄与目标人群重合度高"],
        suggested_role: "amplifier",
        risk_notes: ["近期数据波动较大"],
      },
      {
        index: 3,
        match_score: 0.72,
        reasons: ["性价比高，适合批量种草"],
        suggested_role: "seeder",
        risk_notes: [],
      },
      {
        index: 4,
        match_score: 0.65,
        reasons: ["内容质量稳定"],
        suggested_role: "seeder",
        risk_notes: [],
      },
    ],
  },
  "scoring.evaluate": {
    scores: [
      {
        index: 0,
        overall_score: 88,
        tier: "S",
        dimensions: {
          brand_fit: 92,
          audience_fit: 90,
          content_fit: 88,
          engagement: 85,
          cost_efficiency: 78,
          estimated_roi: 86,
        },
        risk: { level: "low", flags: [] },
        explanation: "垂类契合度与互动质量俱佳，建议作为头部背书优先锁定。",
        shortlist: true,
      },
      {
        index: 1,
        overall_score: 76,
        tier: "A",
        dimensions: {
          brand_fit: 80,
          audience_fit: 78,
          content_fit: 82,
          engagement: 72,
          cost_efficiency: 75,
          estimated_roi: 70,
        },
        risk: { level: "low", flags: [] },
        explanation: "内容风格稳定，报价合理，适合作为腰部主力。",
        shortlist: true,
      },
      {
        index: 2,
        overall_score: 62,
        tier: "B",
        dimensions: {
          brand_fit: 70,
          audience_fit: 65,
          content_fit: 60,
          engagement: 55,
          cost_efficiency: 68,
          estimated_roi: 55,
        },
        risk: { level: "medium", flags: ["近 30 天互动率下滑"] },
        explanation: "数据近期波动，建议观察一周期或压价合作。",
        shortlist: false,
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
  "outreach.draft": {
    subject: "关于焕亮维C精华双十一合作的邀请｜光泽实验室",
    body: "你好呀！一直有关注你的成分测评内容，特别是最近那期精华横评，实测数据做得特别扎实，和我们品牌「重成分、重实证」的理念非常合拍。我们是光泽实验室 GlowLab，正在为双十一档期的焕亮维C精华筹备种草合作，想邀请你参与实测体验。产品是 15% VC 衍生物复配烟酰胺的功效型精华，主打温和提亮，很适合你的粉丝画像。如果有兴趣的话，我们可以先寄样品给你试用，档期和合作形式都好商量。期待你的回复！——光泽实验室品牌合作团队",
    personalization_points: ["近期精华横评内容", "成分党风格与品牌理念契合", "粉丝画像匹配"],
    tone_notes: "亲和专业，先建立内容认同再谈合作，不催促。",
    risk_notes: [],
  },
  "negotiation.analyze": {
    intent: "negotiate",
    intent_summary: "达人有合作意愿，但报价 8 万元高于预算档位，提出希望包含一条额外的直播口播。",
    pricing_analysis: {
      quoted_price_assessment: "报价 8 万对应其 120 万粉丝量级 CPM 偏高约 25%，属于大促期溢价。",
      market_reference: "同量级美妆垂类达人大促期短视频报价通常在 5.5-6.5 万区间。",
      suggested_counter_cents: 6500000,
      walk_away_cents: 7200000,
    },
    strategy: [
      "以长期合作意向换取单条价格让步",
      "将直播口播拆分为可选加购项单独计价",
      "承诺优质内容追加投流预算，放大达人曝光收益",
    ],
    reply_draft:
      "感谢报价与方案！我们内部对齐了一下：单条短视频这边预算上限在 6.5 万，不过我们非常认可你的内容质量，如果这次合作效果好，Q4 还有两个campaign会优先考虑长期合作。直播口播我们建议作为可选项单独谈。你看这个方案是否可以？",
    required_approvals: ["若最终价超过 7.2 万需预算上调审批"],
    risk_notes: ["大促档期紧张，谈判周期不宜超过一周"],
  },
  "content_review.evaluate": {
    decision: "approved",
    risk_level: "high",
    findings: [
      {
        type: "restricted_term",
        severity: "high",
        quote: "医疗级焕亮，7 天治愈暗沉",
        issue: "内容包含品牌禁用词与医疗功效暗示，超出 Brief 允许表达范围。",
        suggestion: "改为“温和提亮肤色，结合 28 天使用记录展示变化”，避免医疗化表述。",
      },
      {
        type: "brief_alignment",
        severity: "medium",
        quote: "没有提到双十一优惠入口",
        issue: "缺少 Brief 要求的购物车优惠 CTA。",
        suggestion: "在结尾补充“点击购物车领取双十一专属优惠”。",
      },
    ],
    creator_feedback:
      "整体内容方向契合成分实测，但含高风险表达；如人工确认已修改或风险可控，方可批准发布。",
  },
  "content_review.rewrite": {
    revised_caption:
      "28 天温和提亮实测来了。光泽实验室焕亮维C精华用 15% VC 衍生物复配烟酰胺，主打温和提亮肤色。我会按早间护肤步骤连续记录肤感和肤色变化，结尾也放了双十一优惠入口，感兴趣可以点购物车看看。",
    revised_transcript:
      "这次测试的是光泽实验室焕亮维C精华。它的重点不是夸张承诺，而是用 15% VC 衍生物和烟酰胺做温和提亮护理。我会连续记录 28 天使用感受，包括质地、吸收、妆前叠加和肤色观感变化。敏感肌同学也建议先做局部测试。双十一期间购物车有专属优惠，大家可以按自己的肤质和预算理性选择。",
    change_summary: [
      "删除医疗化和绝对化表达，改为温和提亮与 28 天记录。",
      "补充 Brief 要求的购物车优惠 CTA。",
      "保留达人实测口吻，同时加入局部测试提醒。",
    ],
    creator_message: "已按审核意见改为更稳妥的功效表达，并补齐双十一优惠入口。",
  },
  "analytics.analyze": {
    summary:
      "近 30 天内容曝光与互动保持增长，短视频内容贡献了主要观看量；当前转化数据仍不完整，ROI 判断需要谨慎。",
    kpi_status: [
      {
        name: "曝光",
        status: "on_track",
        actual: 1280000,
        target: 1000000,
        note: "曝光已超过阶段目标。",
      },
      {
        name: "转化",
        status: "unknown",
        actual: null,
        target: 1200,
        note: "缺少完整订单回传，暂不判断。",
      },
    ],
    top_performers: [
      { entity_id: "content-top", reason: "短视频完播与互动均高于均值", metric: "views" },
    ],
    low_performers: [
      { entity_id: "content-low", reason: "点击率低于 Campaign 均值", metric: "clicks" },
    ],
    anomalies: [
      {
        title: "7 月中旬评论量异常升高",
        severity: "warning",
        explanation: "评论量相对前 7 日均值增长明显，可能与争议词讨论相关（推断）。",
        evidence: "comments 环比增长 68%",
      },
    ],
    recommendations: [
      {
        action: "优先复投高完播短视频，并要求达人追加购物车 CTA",
        rationale: "观看和互动已经达标，但点击链路仍有提升空间。",
        owner_hint: "内容负责人",
      },
    ],
    data_quality_notes: ["缺少部分平台的 revenue_cents 和 cost_cents，ROI 仅可作为方向参考。"],
  },
  "report.generate": {
    title: "焕亮维C精华 双十一种草阶段复盘",
    executive_summary:
      "本阶段通过成分实测内容带动曝光增长，互动表现优于预期；受订单回传缺口影响，转化效率仍需补数后复核。",
    narrative:
      "事实：短视频内容贡献主要观看量，评论与收藏增长明显。推断：成分党叙事强化了信任，但购买 CTA 露出不足限制了点击转化。",
    key_learnings: ["成分实测内容更适合承担信任背书", "内容末尾 CTA 对点击表现影响明显"],
    recommendations: [
      "复投高完播达人素材",
      "补齐订单回传后重新计算 ROI",
      "下一轮 Brief 强制加入购物车 CTA",
    ],
    data_limitations: ["部分平台缺少收入与成本字段", "达人级归因仍有滞后"],
    requires_approval: true,
  },
  "knowledge.answer": {
    answer:
      "根据知识库片段，历史美妆 Campaign 更适合采用成分实测内容承接信任，并用购物车 CTA 补齐转化链路。 [1]",
    citations: [{ chunk_id: "chunk-1", quote: "成分实测内容更适合承担信任背书" }],
    confidence: 0.82,
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
