import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateAgentRuns: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    agentRun: { updateMany: mocks.updateAgentRuns },
  },
}));

describe("Agent 运行终态保护", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("完成写入只匹配 running 状态", async () => {
    mocks.updateAgentRuns.mockResolvedValue({ count: 1 });
    const { agentMonitorRepository } = await import("./agent-monitor.repository");

    const committed = await agentMonitorRepository.completeRun(
      "org-1",
      "agent-run-1",
      { ok: true },
      "gpt-test",
    );

    expect(committed).toBe(true);
    expect(mocks.updateAgentRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent-run-1", tenantId: "org-1", status: "running" },
      }),
    );
  });

  it("已被取消时返回 false，不覆盖终态", async () => {
    mocks.updateAgentRuns.mockResolvedValue({ count: 0 });
    const { agentMonitorRepository } = await import("./agent-monitor.repository");

    const committed = await agentMonitorRepository.failRun(
      "org-1",
      "agent-run-1",
      "迟到失败",
    );

    expect(committed).toBe(false);
    expect(mocks.updateAgentRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent-run-1", tenantId: "org-1", status: "running" },
      }),
    );
  });
});
