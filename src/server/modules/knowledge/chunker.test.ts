import { describe, expect, it } from "vitest";
import { chunkText } from "./chunker";

describe("知识库分块器", () => {
  it("按段落生成稳定分块并保留标题路径", () => {
    const chunks = chunkText(
      `# 投放复盘

成分实测内容更适合承担信任背书，尤其适合护肤 Campaign。达人需要记录 28 天使用变化，并把配方逻辑讲清楚。

购物车 CTA 需要在视频结尾明确露出，便于承接转化。没有 CTA 的内容点击率低于 Campaign 均值，需要在 Brief 中提前约束。`,
      { maxChars: 80, overlapChars: 10 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      headingPath: "投放复盘",
    });
    expect(chunks[0]!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(chunks.every((chunk, index) => chunk.chunkIndex === index)).toBe(true);
  });

  it("空白文本不会生成分块", () => {
    expect(chunkText(" \n\n\t ")).toEqual([]);
  });
});
