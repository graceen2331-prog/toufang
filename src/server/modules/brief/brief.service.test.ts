import { beforeEach, describe, expect, it, vi } from "vitest";

const findByCampaign = vi.fn();
const listVersions = vi.fn();
const findVersion = vi.fn();

vi.mock("./brief.repository", () => ({
  briefRepository: {
    findByCampaign,
    listVersions,
    findVersion,
    create: vi.fn(),
    addVersion: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock("@/server/modules/user/user.repository", () => ({
  getUserNames: vi.fn(async () => new Map()),
}));

vi.mock("@/server/modules/status-events/status-event.repository", () => ({
  recordStatusEvent: vi.fn(),
}));

const baseBrief = {
  id: "brief-1",
  tenantId: "org-1",
  campaignId: "campaign-1",
  title: "种草 Brief",
  status: "draft",
  currentVersionId: "version-1",
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date("2026-07-07T00:00:00.000Z"),
  updatedAt: new Date("2026-07-07T00:00:00.000Z"),
  createdBy: "user-1",
  updatedBy: null,
  deletedAt: null,
};

const baseVersion = {
  id: "version-1",
  tenantId: "org-1",
  briefId: "brief-1",
  version: 1,
  content: {
    title: "种草 Brief",
    background: "主打敏感肌修护。",
  },
  plainText: "# 种草 Brief",
  changeSummary: null,
  aiGenerated: true,
  model: "fake",
  promptKey: "brief.generate",
  promptVersion: "v1",
  createdAt: new Date("2026-07-07T00:00:00.000Z"),
  createdBy: "user-1",
};

describe("Brief service DTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("把数据库里缺省的 Brief 数组字段补成空数组", async () => {
    findByCampaign.mockResolvedValue(baseBrief);
    listVersions.mockResolvedValue([baseVersion]);

    const { getBriefByCampaign } = await import("./brief.service");

    const result = await getBriefByCampaign({ orgId: "org-1", userId: "user-1" }, "campaign-1");

    expect(result?.current_version?.content.key_messages).toEqual([]);
    expect(result?.current_version?.content.must_include).toEqual([]);
    expect(result?.current_version?.content.must_avoid).toEqual([]);
    expect(result?.current_version?.content.deliverables).toEqual([]);
    expect(result?.current_version?.content.platform_requirements).toEqual([]);
  });

  it("读取单个版本时同样归一化缺省字段", async () => {
    findVersion.mockResolvedValue(baseVersion);

    const { getBriefVersion } = await import("./brief.service");

    const result = await getBriefVersion({ orgId: "org-1", userId: "user-1" }, "version-1");

    expect(result.content.key_messages).toEqual([]);
    expect(result.content.deliverables).toEqual([]);
    expect(result.content.platform_requirements).toEqual([]);
  });
});
