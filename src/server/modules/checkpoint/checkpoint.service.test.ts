import { beforeEach, describe, expect, it, vi } from "vitest";

const pendingCheckpoint = {
  id: "checkpoint-1",
  tenantId: "org-1",
  workflowRunId: null,
  type: "outreach_send",
  status: "pending",
  title: "外联消息发送审批",
  summary: "请审批",
  entityType: "outreach_message",
  entityId: "message-1",
  payload: {},
  priority: "high",
  assigneeRole: "manager",
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  createdAt: new Date("2026-07-04T00:00:00.000Z"),
  createdBy: "user-1",
};

const decidedCheckpoint = {
  ...pendingCheckpoint,
  status: "approved",
  decidedBy: "user-1",
  decidedAt: new Date("2026-07-04T00:01:00.000Z"),
};

const findById = vi.fn();
const decide = vi.fn();
const getUserNames = vi.fn();
const onOutreachApprovalDecided = vi.fn();
const decideReportCheckpoint = vi.fn();
const decideContentCheckpoint = vi.fn();
const onCheckpointDecided = vi.fn();

vi.mock("./checkpoint.repository", () => ({
  checkpointRepository: {
    findById,
    decide,
  },
}));

vi.mock("@/server/modules/user/user.repository", () => ({
  getUserNames,
}));

vi.mock("@/server/modules/outreach/outreach.service", () => ({
  onOutreachApprovalDecided,
}));

vi.mock("@/server/modules/analytics/analytics.service", () => ({
  decideReportCheckpoint,
}));

vi.mock("@/server/modules/content/content.service", () => ({
  decideContentCheckpoint,
}));

vi.mock("@/server/workflows/engine", () => ({
  onCheckpointDecided,
}));

describe("decideCheckpoint 外联审批联动", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValueOnce(pendingCheckpoint).mockResolvedValueOnce(decidedCheckpoint);
    decide.mockResolvedValue(true);
    getUserNames.mockResolvedValue(new Map([["user-1", "林星澜"]]));
  });

  it("批准 outreach_send 审批项时同步更新外联消息状态", async () => {
    const { decideCheckpoint } = await import("./checkpoint.service");

    await decideCheckpoint({ orgId: "org-1", userId: "user-1" }, "checkpoint-1", "approved");

    expect(onOutreachApprovalDecided).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      "message-1",
      "approved",
    );
  });
});

describe("decideCheckpoint 正式报告原子审批", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const reportCheckpoint = {
      ...pendingCheckpoint,
      type: "report",
      entityType: "report",
      entityId: "report-1",
      title: "报告审批",
    };
    findById
      .mockResolvedValueOnce(reportCheckpoint)
      .mockResolvedValueOnce({ ...reportCheckpoint, status: "approved", decidedBy: "user-1" });
    decideReportCheckpoint.mockResolvedValue(undefined);
    getUserNames.mockResolvedValue(new Map([["user-1", "林星澜"]]));
  });

  it("交由报告领域事务同时决定审批与报告状态", async () => {
    const { decideCheckpoint } = await import("./checkpoint.service");

    await decideCheckpoint({ orgId: "org-1", userId: "user-1" }, "checkpoint-1", "approved");

    expect(decideReportCheckpoint).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      "checkpoint-1",
      "report-1",
      "approved",
      null,
    );
    expect(decide).not.toHaveBeenCalled();
  });
});

describe("decideCheckpoint 内容合规原子审批", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const contentCheckpoint = {
      ...pendingCheckpoint,
      workflowRunId: "workflow-1",
      type: "content",
      entityType: "content_asset",
      entityId: "asset-1",
      title: "内容审核复核",
    };
    findById
      .mockResolvedValueOnce(contentCheckpoint)
      .mockResolvedValueOnce({ ...contentCheckpoint, status: "approved", decidedBy: "user-1" });
    decideContentCheckpoint.mockResolvedValue(undefined);
    getUserNames.mockResolvedValue(new Map([["user-1", "林星澜"]]));
  });

  it("先由内容领域事务落地审批证据，再恢复工作流做幂等收尾", async () => {
    const { decideCheckpoint } = await import("./checkpoint.service");
    const override = {
      enabled: true as const,
      category: "evidence_verified" as const,
      acknowledged_finding_ids: ["finding-1"],
    };

    await decideCheckpoint(
      { orgId: "org-1", userId: "user-1" },
      "checkpoint-1",
      "approved",
      "已核验全部风险证据，可以批准",
      override,
    );

    expect(decideContentCheckpoint).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      "checkpoint-1",
      {
        decision: "approved",
        reason: "已核验全部风险证据，可以批准",
        override,
      },
    );
    expect(decide).not.toHaveBeenCalled();
    expect(onCheckpointDecided).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      "workflow-1",
      "checkpoint-1",
      "approved",
    );
  });
});
