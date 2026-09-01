import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRun: vi.fn(),
  updateRuns: vi.fn(),
  recordStatusEvent: vi.fn(),
}));

const tx = {
  workflowRun: {
    findFirst: mocks.findRun,
    updateMany: mocks.updateRuns,
  },
};

vi.mock("@/server/db/client", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}));

vi.mock("@/server/modules/status-events/status-event.repository", () => ({
  recordStatusEvent: mocks.recordStatusEvent,
}));

describe("工作流生命周期仓储", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("只允许 running 原子提交为 completed", async () => {
    mocks.findRun.mockResolvedValue({ status: "running" });
    mocks.updateRuns.mockResolvedValue({ count: 1 });
    const { workflowLifecycleRepository } = await import("./workflow-lifecycle.repository");

    const committed = await workflowLifecycleRepository.completeRun({
      tenantId: "org-1",
      runId: "run-1",
      output: { ok: true },
    });

    expect(committed).toBe(true);
    expect(mocks.updateRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1", tenantId: "org-1", status: "running" },
        data: expect.objectContaining({ status: "completed", output: { ok: true } }),
      }),
    );
    expect(mocks.recordStatusEvent).toHaveBeenCalledOnce();
  });

  it("已取消运行拒绝迟到的完成写入", async () => {
    mocks.findRun.mockResolvedValue({ status: "cancelled" });
    const { workflowLifecycleRepository } = await import("./workflow-lifecycle.repository");

    const committed = await workflowLifecycleRepository.completeRun({
      tenantId: "org-1",
      runId: "run-1",
      output: { late: true },
    });

    expect(committed).toBe(false);
    expect(mocks.updateRuns).not.toHaveBeenCalled();
    expect(mocks.recordStatusEvent).not.toHaveBeenCalled();
  });
});
