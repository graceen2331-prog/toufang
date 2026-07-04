import { beforeEach, describe, expect, it, vi } from "vitest";

const findAsset = vi.fn();
const transitionAsset = vi.fn();
const findActiveWorkflow = vi.fn();
const createQueuedReview = vi.fn();
const startWorkflow = vi.fn();

vi.mock("./content.repository", () => ({
  contentRepository: {
    findAsset,
    transitionAsset,
    findActiveWorkflow,
    createQueuedReview,
  },
}));

vi.mock("@/server/workflows/engine", () => ({
  startWorkflow,
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
    findActiveWorkflow.mockResolvedValue(null);
    createQueuedReview.mockResolvedValue({ id: "review-1" });
    startWorkflow.mockResolvedValue({ id: "run-1" });
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

  it("允许审核中但没有活跃工作流的内容重新发起 AI 审核", async () => {
    findAsset.mockResolvedValue(asset);
    const { startContentReviewWorkflow } = await import("./content.service");

    const result = await startContentReviewWorkflow(
      { orgId: "org-1", userId: "user-1" },
      "asset-1",
      "重新审核",
    );

    expect(result.workflow_run_id).toBe("run-1");
    expect(createQueuedReview).toHaveBeenCalledWith({ orgId: "org-1", userId: "user-1" }, "asset-1");
    expect(startWorkflow).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      {
        key: "content_review",
        subjectType: "content_asset",
        subjectId: "asset-1",
        input: { review_id: "review-1", instruction: "重新审核" },
      },
    );
    expect(transitionAsset).not.toHaveBeenCalled();
  });

  it("已提交内容发起审核时，工作流创建成功后才进入审核中", async () => {
    findAsset.mockResolvedValue({ ...asset, status: "submitted" });
    const { startContentReviewWorkflow } = await import("./content.service");

    await startContentReviewWorkflow({ orgId: "org-1", userId: "user-1" }, "asset-1");

    expect(startWorkflow).toHaveBeenCalled();
    expect(transitionAsset).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      "asset-1",
      "submitted",
      "in_review",
      "发起内容审核",
    );
    expect(startWorkflow.mock.invocationCallOrder[0]).toBeLessThan(
      transitionAsset.mock.invocationCallOrder[0]!,
    );
  });

  it("工作流启动失败时不会提前把内容锁进审核中", async () => {
    findAsset.mockResolvedValue({ ...asset, status: "submitted" });
    startWorkflow.mockRejectedValue(new Error("未注册的工作流: content_review"));
    const { startContentReviewWorkflow } = await import("./content.service");

    await expect(
      startContentReviewWorkflow({ orgId: "org-1", userId: "user-1" }, "asset-1"),
    ).rejects.toThrow("未注册的工作流");
    expect(transitionAsset).not.toHaveBeenCalled();
  });
});
