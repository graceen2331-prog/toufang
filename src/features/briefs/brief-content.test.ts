import { describe, expect, it } from "vitest";
import { normalizeBriefContent } from "./brief-content";

describe("normalizeBriefContent", () => {
  it("为旧 Brief JSON 补齐数组字段，避免详情页渲染崩溃", () => {
    const content = normalizeBriefContent({
      title: "旧版 Brief",
      background: "背景",
    });

    expect(content.key_messages).toEqual([]);
    expect(content.must_include).toEqual([]);
    expect(content.must_avoid).toEqual([]);
    expect(content.deliverables).toEqual([]);
    expect(content.platform_requirements).toEqual([]);
  });

  it("把空值数组字段归一化为空数组", () => {
    const content = normalizeBriefContent({
      title: "异常 Brief",
      key_messages: null,
      deliverables: null,
      platform_requirements: [{ platform: "TikTok", requirements: null }],
    });

    expect(content.key_messages).toEqual([]);
    expect(content.deliverables).toEqual([]);
    expect(content.platform_requirements).toEqual([{ platform: "TikTok", requirements: [] }]);
  });
});
