import { beforeEach, describe, expect, it, vi } from "vitest";

const findMessage = vi.fn();
const transitionMessage = vi.fn();
const listThreadsByCampaignCreatorIds = vi.fn();
const findCampaign = vi.fn();
const findCampaignCreator = vi.fn();
const listCampaignCreators = vi.fn();

vi.mock("./outreach.repository", () => ({
  outreachRepository: {
    findMessage,
    transitionMessage,
    listThreadsByCampaignCreatorIds,
  },
}));

vi.mock("@/server/modules/checkpoint/checkpoint.repository", () => ({
  checkpointRepository: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/modules/campaign/campaign.repository", () => ({
  campaignRepository: {
    findById: findCampaign,
    findCampaignCreator,
    listCreators: listCampaignCreators,
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

describe("listOutreachCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("按 Campaign 返回筛选出的达人，并标记是否可创建外联会话", async () => {
    findCampaign.mockResolvedValue({ id: "campaign-1" });
    listCampaignCreators.mockResolvedValue([
      {
        id: "cc-approved",
        campaignId: "campaign-1",
        creatorId: "creator-1",
        creator: { displayName: "林小鹿" },
        status: "approved",
        role: "hero",
        quotedPriceCents: 500_000,
        agreedPriceCents: null,
      },
      {
        id: "cc-candidate",
        campaignId: "campaign-1",
        creatorId: "creator-2",
        creator: { displayName: "候选达人" },
        status: "candidate",
        role: null,
        quotedPriceCents: null,
        agreedPriceCents: null,
      },
      {
        id: "cc-active",
        campaignId: "campaign-1",
        creatorId: "creator-3",
        creator: { displayName: "陈澈" },
        status: "active",
        role: "amplifier",
        quotedPriceCents: null,
        agreedPriceCents: 800_000,
      },
    ]);
    listThreadsByCampaignCreatorIds.mockResolvedValue([
      {
        id: "thread-new",
        campaignCreatorId: "cc-active",
        status: "replied",
        subject: "最新外联",
      },
      {
        id: "thread-old",
        campaignCreatorId: "cc-active",
        status: "open",
        subject: "旧外联",
      },
    ]);

    const { listOutreachCandidates } = await import("./outreach.service");

    await expect(
      listOutreachCandidates({ orgId: "org-1", userId: "user-1" }, "campaign-1"),
    ).resolves.toEqual([
      {
        campaign_creator_id: "cc-approved",
        campaign_id: "campaign-1",
        creator_id: "creator-1",
        creator_name: "林小鹿",
        status: "approved",
        role: "hero",
        quoted_price_cents: 500_000,
        agreed_price_cents: null,
        can_create_thread: true,
        blocked_reason: null,
        existing_thread_id: null,
        existing_thread_status: null,
        existing_thread_subject: null,
      },
      {
        campaign_creator_id: "cc-candidate",
        campaign_id: "campaign-1",
        creator_id: "creator-2",
        creator_name: "候选达人",
        status: "candidate",
        role: null,
        quoted_price_cents: null,
        agreed_price_cents: null,
        can_create_thread: false,
        blocked_reason: "需先把达人推进到已批准或执行中状态",
        existing_thread_id: null,
        existing_thread_status: null,
        existing_thread_subject: null,
      },
      {
        campaign_creator_id: "cc-active",
        campaign_id: "campaign-1",
        creator_id: "creator-3",
        creator_name: "陈澈",
        status: "active",
        role: "amplifier",
        quoted_price_cents: null,
        agreed_price_cents: 800_000,
        can_create_thread: false,
        blocked_reason: null,
        existing_thread_id: "thread-new",
        existing_thread_status: "replied",
        existing_thread_subject: "最新外联",
      },
    ]);
    expect(listThreadsByCampaignCreatorIds).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      ["cc-approved", "cc-candidate", "cc-active"],
    );
  });
});
