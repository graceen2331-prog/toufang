import { describe, expect, it } from "vitest";
import { normalizeKnowledgeAnswer } from "./knowledge.service";
import type { RetrievedKnowledgeChunk } from "./knowledge.repository";

const retrieved: RetrievedKnowledgeChunk[] = [
  {
    chunk_id: "chunk-real-1",
    document_id: "doc-1",
    title: "双十一复盘",
    content: "成分实测内容更适合承担信任背书，下一轮 Brief 应强制加入购物车 CTA。",
    heading_path: null,
    distance: 0.1,
    score: 0.9,
  },
];

describe("知识问答引用格式", () => {
  it("模型未返回有效 chunk_id 时回退到检索片段并补齐 [1] 引用", () => {
    const result = normalizeKnowledgeAnswer(
      {
        answer: "历史经验建议优先使用成分实测内容承接信任。",
        citations: [{ chunk_id: "unknown", quote: "不存在" }],
        confidence: 0.7,
      },
      retrieved,
    );

    expect(result.answer).toContain("[1]");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      index: 1,
      chunk_id: "chunk-real-1",
      document_id: "doc-1",
      title: "双十一复盘",
    });
  });

  it("无检索上下文时明确说明知识库中没有", () => {
    const result = normalizeKnowledgeAnswer(
      { answer: "不知道", citations: [], confidence: 0.9 },
      [],
    );

    expect(result.answer).toContain("知识库中没有");
    expect(result.confidence).toBe(0);
    expect(result.citations).toEqual([]);
  });
});
