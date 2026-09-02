import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { validateMutationOrigin } from "./request-origin";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://app.example.com/api/v1/auth/login", {
    method: "POST",
    headers,
  });
}

const production: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  APP_ORIGIN: "https://app.example.com",
};

describe("变更请求来源校验", () => {
  it("允许完全匹配的 Origin", () => {
    expect(() =>
      validateMutationOrigin(
        request({ origin: "https://app.example.com", "sec-fetch-site": "same-origin" }),
        production,
      ),
    ).not.toThrow();
  });

  it("拒绝跨源、null Origin 和矛盾的 Fetch Metadata", () => {
    expect(() => validateMutationOrigin(request({ origin: "https://evil.example" }), production))
      .toThrow("请求来源校验失败");
    expect(() => validateMutationOrigin(request({ origin: "null" }), production))
      .toThrow("请求来源校验失败");
    expect(() =>
      validateMutationOrigin(
        request({ origin: "https://app.example.com", "sec-fetch-site": "cross-site" }),
        production,
      ),
    ).toThrow("请求来源校验失败");
  });

  it("生产环境仅在 same-origin Fetch Metadata 下允许缺少 Origin", () => {
    expect(() =>
      validateMutationOrigin(request({ "sec-fetch-site": "same-origin" }), production),
    ).not.toThrow();
    expect(() => validateMutationOrigin(request(), production)).toThrow("请求缺少可信来源信息");
  });
});
