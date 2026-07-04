import { beforeEach, describe, expect, it, vi } from "vitest";

const findAsset = vi.fn();
const transitionAsset = vi.fn();

vi.mock("./content.repository", () => ({
  contentRepository: {
    findAsset,
    transitionAsset,
    findActiveWorkflow: vi.fn(),
    createQueuedReview: vi.fn(),
  },
}));

vi.mock("@/server/workflows/engine", () => ({
  startWorkflow: vi.fn(),
}));

vi.mock("@/server/modules/campaign/campaign.repository", () => ({
  campaignRepository: {
    transitionCreatorField: vi.fn(),
  },
}));

const asset = {
  id: "asset-1",
  tenantId: "org-1",
  campaignCreatorId: "cc-1",
  briefId: "brief-1",
  title: "内容初稿",
  status: "in_review",
  contentType: "video",
  platform: "douyin",
  caption: "测试",
  transcript: "测试",
  url: null,
  fileId: null,
  plannedPublishAt: null,
  publishedAt: null,
  publishedUrl: null,
  createdAt: new Date("2026-07-04T00:00:00.000Z"),
  updatedAt: new Date("2026-07-04T00:00:00.000Z"),
  createdBy: "user-1",
  updatedBy: null,
  deletedAt: null,
  reviews: [],
  pendingWorkflow: null,
  brief: { id: "brief-1", title: "Brief", currentVersion: {} },
  campaignCreator: {
    id: "cc-1",
    contentStatus: "submitted",
    campaign: { id: "campaign-1", name: "Campaign" },
    creator: { displayName: "林小鹿" },
  },
};

describe("内容审核审批门", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("不允许绕过审批中心直接把审核中内容标记为已过审", async () => {
    findAsset.mockResolvedValue(asset);
    const { transitionContentAssetStatus } = await import("./content.service");

    await expect(
      transitionContentAssetStatus({ orgId: "org-1", userId: "user-1" }, "asset-1", "approved"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(transitionAsset).not.toHaveBeenCalled();
  });

  it("不允许绕过审批中心直接要求修改", async () => {
    findAsset.mockResolvedValue(asset);
    const { transitionContentAssetStatus } = await import("./content.service");

    await expect(
      transitionContentAssetStatus({ orgId: "org-1", userId: "user-1" }, "asset-1", "revision_requested"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(transitionAsset).not.toHaveBeenCalled();
  });
});
