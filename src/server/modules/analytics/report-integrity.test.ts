import { describe, expect, it } from "vitest";
import { buildReportSnapshot, hashReportSnapshot } from "./report-integrity";

const base = {
  id: "report-1",
  seriesId: "series-1",
  version: 1,
  campaignId: "campaign-1",
  title: "复盘报告",
  kind: "campaign_retro",
  content: { summary: "结果", metrics: { views: 100, likes: 10 } },
  aiGenerated: true,
  agentRunId: "agent-1",
  promptKey: "report.generate",
  promptVersion: "v1",
  model: "fake-model",
};

describe("报告正式快照哈希", () => {
  it("对象键顺序不影响哈希", () => {
    const first = buildReportSnapshot(base);
    const second = buildReportSnapshot({
      ...base,
      content: { metrics: { likes: 10, views: 100 }, summary: "结果" },
    });
    expect(hashReportSnapshot(first)).toBe(hashReportSnapshot(second));
  });

  it.each([
    { title: "被修改的标题" },
    { content: { summary: "被修改的内容" } },
    { model: "other-model" },
  ])("任一受保护字段变化都会改变哈希：%o", (change) => {
    const original = hashReportSnapshot(buildReportSnapshot(base));
    const changed = hashReportSnapshot(buildReportSnapshot({ ...base, ...change }));
    expect(changed).not.toBe(original);
  });
});
