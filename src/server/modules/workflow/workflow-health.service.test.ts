import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRunStatus: vi.fn(),
  getWorkersCount: vi.fn(),
}));

vi.mock("@/server/modules/workflow/workflow.repository", () => ({
  workflowRepository: { findRunStatus: mocks.findRunStatus },
}));

vi.mock("@/server/jobs/queues", () => ({
  getWorkflowStepQueue: () => ({ getWorkersCount: mocks.getWorkersCount }),
}));

describe("工作流执行健康提示", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("worker 离线时返回可恢复提示，不暴露队列明细", async () => {
    mocks.findRunStatus.mockResolvedValue({
      id: "run-1",
      status: "queued",
      createdAt: new Date(),
      startedAt: null,
    });
    mocks.getWorkersCount.mockResolvedValue(0);
    const { getWorkflowExecutionHealth } = await import("./workflow-health.service");

    const result = await getWorkflowExecutionHealth({ orgId: "org-1" }, "run-1");

    expect(result.status).toBe("offline");
    expect(result.message).toContain("恢复后将自动继续");
    expect(result).not.toHaveProperty("workers");
    expect(result).not.toHaveProperty("waiting");
  });

  it("终态运行无需查询 worker", async () => {
    mocks.findRunStatus.mockResolvedValue({
      id: "run-1",
      status: "completed",
      createdAt: new Date(),
      startedAt: new Date(),
    });
    const { getWorkflowExecutionHealth } = await import("./workflow-health.service");

    const result = await getWorkflowExecutionHealth({ orgId: "org-1" }, "run-1");

    expect(result.status).toBe("not_applicable");
    expect(mocks.getWorkersCount).not.toHaveBeenCalled();
  });
});
