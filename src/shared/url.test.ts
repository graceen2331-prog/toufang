import { describe, expect, it } from "vitest";
import { normalizeExternalUrl } from "./url";

describe("normalizeExternalUrl", () => {
  it("为裸域名补齐 https 协议", () => {
    expect(normalizeExternalUrl("example.com")).toBe("https://example.com/");
    expect(normalizeExternalUrl("www.example.com/path?q=1")).toBe(
      "https://www.example.com/path?q=1",
    );
  });

  it("保留已有 http/https 链接", () => {
    expect(normalizeExternalUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeExternalUrl("http://example.com")).toBe("http://example.com/");
  });

  it("过滤空值、无效域名和非网页协议", () => {
    expect(normalizeExternalUrl("")).toBeNull();
    expect(normalizeExternalUrl("localhost")).toBeNull();
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
  });
});
