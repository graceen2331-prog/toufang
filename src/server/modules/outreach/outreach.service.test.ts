import { beforeEach, describe, expect, it, vi } from "vitest";

const findMessage = vi.fn();
const transitionMessage = vi.fn();

vi.mock("./outreach.repository", () => ({
  outreachRepository: {
    findMessage,
    transitionMessage,
  },
}));

vi.mock("@/server/modules/checkpoint/checkpoint.repository", () => ({
  checkpointRepository: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/modules/campaign/campaign.repository", () => ({
  campaignRepository: {
    findCampaignCreator: vi.fn(),
    transitionCreatorField: vi.fn(),
  },
}));

vi.mock("@/server/ai/agents/run-agent", () => ({
  runAgent: vi.fn(),
}));

describe("transitionMessage 审批门", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("不允许绕过审批中心直接把待审批外联消息标记为已批准", async () => {
    findMessage.mockResolvedValue({
      id: "message-1",
      tenantId: "org-1",
      threadId: "thread-1",
      direction: "outbound",
      status: "pending_approval",
      approvalStatus: "pending",
      subject: "合作邀约",
      body: "请确认是否发送",
      replyIntent: null,
      aiGenerated: false,
      agentRunId: null,
      promptKey: null,
      promptVersion: null,
      model: null,
      sentAt: null,
      createdAt: new Date("2026-07-04T00:00:00.000Z"),
      updatedAt: new Date("2026-07-04T00:00:00.000Z"),
      createdBy: "user-1",
      updatedBy: null,
      deletedAt: null,
    });

    const { transitionMessage: transition } = await import("./outreach.service");

    await expect(
      transition({ orgId: "org-1", userId: "user-1" }, "message-1", "approved"),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(transitionMessage).not.toHaveBeenCalled();
  });
});
