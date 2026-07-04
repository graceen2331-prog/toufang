import { beforeEach, describe, expect, it, vi } from "vitest";

const markRead = vi.fn();
const markAllRead = vi.fn();

vi.mock("./notification.repository", () => ({
  notificationRepository: {
    list: vi.fn(),
    countUnread: vi.fn(),
    markRead,
    markAllRead,
    createForUser: vi.fn(),
    findActiveUsersByRole: vi.fn(),
  },
}));

describe("通知已读逻辑", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("指定 ids 时只标记当前用户的这些通知", async () => {
    markRead.mockResolvedValue(2);
    const { markNotificationsRead } = await import("./notification.service");

    const result = await markNotificationsRead(
      { orgId: "org-1", userId: "user-1" },
      { ids: ["n1", "n2"] },
    );

    expect(result).toEqual({ updated: 2 });
    expect(markRead).toHaveBeenCalledWith({ orgId: "org-1", userId: "user-1" }, ["n1", "n2"]);
    expect(markAllRead).not.toHaveBeenCalled();
  });

  it("all=true 时标记当前用户全部未读通知", async () => {
    markAllRead.mockResolvedValue(5);
    const { markNotificationsRead } = await import("./notification.service");

    const result = await markNotificationsRead({ orgId: "org-1", userId: "user-1" }, { all: true });

    expect(result).toEqual({ updated: 5 });
    expect(markAllRead).toHaveBeenCalledWith({ orgId: "org-1", userId: "user-1" });
    expect(markRead).not.toHaveBeenCalled();
  });
});
