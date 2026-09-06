import { describe, expect, it } from "vitest";
import {
  evaluateDeterministicContent,
  hashContentInput,
  mergeContentReview,
  normalizePolicyText,
} from "./content-policy";

describe("内容确定性护栏", () => {
  it("统一全半角、大小写与空白后稳定计算正文哈希", () => {
    expect(normalizePolicyText("ＡBC  \n 测试")).toBe("abc 测试");
    expect(
      hashContentInput({ platform: "DouYin", caption: "ＡBC  测试", transcript: null }),
    ).toBe(hashContentInput({ platform: "douyin", caption: "abc 测试", transcript: "" }));
  });

  it("把租户禁词当字面量匹配并生成不可覆盖 finding", () => {
    const result = evaluateDeterministicContent({
      platform: "douyin",
      caption: "这款产品含有 a+b 配方",
      transcript: null,
      brandRestrictedTerms: ["a+b"],
      briefContent: {},
    });

    expect(result.findings).toEqual([
      expect.objectContaining({
        type: "restricted_term",
        quote: "a+b",
        blocking: true,
        origin: "deterministic",
      }),
    ]);
  });

  it("只把 Brief 的结构化 compliance 作为确定性规则", () => {
    const result = evaluateDeterministicContent({
      platform: "xiaohongshu",
      caption: "真实体验",
      transcript: null,
      brandRestrictedTerms: [],
      briefContent: {
        platform_requirements: [{ requirements: ["自由文本要求不会伪装成机器规则"] }],
        compliance: {
          required_terms: ["理性选择"],
          required_hashtags: ["#品牌合作"],
          prohibited_terms: ["根治"],
        },
      },
    });

    expect(result.findings.map((finding) => finding.type)).toEqual([
      "brief_required_term",
      "brief_required_hashtag",
    ]);
  });

  it("AI 不能把 high finding 降级为低风险批准", () => {
    const deterministic = evaluateDeterministicContent({
      platform: "douyin",
      caption: "普通体验分享",
      transcript: null,
      brandRestrictedTerms: [],
      briefContent: {},
    });
    const merged = mergeContentReview(
      {
        decision: "approved",
        risk_level: "low",
        findings: [
          {
            type: "claim_risk",
            severity: "high",
            quote: "普通体验分享",
            issue: "需要人工复核语义风险",
            suggestion: "核对依据",
          },
        ],
        creator_feedback: "请人工确认。",
      },
      deterministic,
    );

    expect(merged).toMatchObject({
      decision: "needs_revision",
      risk_level: "high",
      normalization_notes: ["AI_RISK_LOWER_THAN_FINDINGS", "AI_APPROVED_WITH_HIGH_FINDING"],
    });
    expect(merged.findings[0]).toMatchObject({ origin: "ai", blocking: false });
  });
});
