import { describe, expect, it } from "vitest";
import { classifyAgentError, redactSensitive } from "./agent-monitor.utils";

describe("Agent 监测脱敏", () => {
  it("递归隐藏敏感键和文本中的联系方式、令牌", () => {
    const result = redactSensitive({
      profile: {
        email: "creator@example.com",
        phone: "+86 138 0013 8000",
        name: "顾清禾",
      },
      message: "联系 creator@example.com，凭证 Bearer abc.def.ghi",
      api_key: "sk-abcdefghijklmnop",
    });

    expect(result).toEqual({
      profile: { email: "••••••", phone: "••••••", name: "顾清禾" },
      message: "联系 [已脱敏邮箱]，凭证 Bearer [已脱敏]",
      api_key: "••••••",
    });
  });

  it("保留普通结构和值", () => {
    expect(redactSensitive({ campaign: "秋季上新", score: 87 })).toEqual({
      campaign: "秋季上新",
      score: 87,
    });
  });
});

describe("Agent 错误分类", () => {
  it.each([
    [{ code: "AI_BUDGET_EXCEEDED", message: "预算不足" }, "budget"],
    [new Error("OpenAI API 错误 429: rate limit"), "rate_limit"],
    [new Error("provider request timeout"), "timeout"],
    [{ code: "AI_OUTPUT_INVALID", message: "JSON 校验失败" }, "validation"],
    [new Error("OpenAI provider unavailable"), "provider"],
  ])("将 %o 分类为 %s", (error, expected) => {
    expect(classifyAgentError(error).type).toBe(expected);
  });
});
