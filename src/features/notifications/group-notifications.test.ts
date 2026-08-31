import { describe, expect, it } from "vitest";
import type { NotificationDto } from "@/shared/schemas/notification";
import { getNotificationDisplayBody, groupNotifications } from "./group-notifications";

const notification = (overrides: Partial<NotificationDto> = {}): NotificationDto => ({
  id: "n-1",
  type: "workflow_completed",
  title: "工作流已完成：内容审核",
  body: "content / 123e4567-e89b-12d3-a456-426614174000",
  link_url: "/ai-runs/run-1",
  priority: "normal",
  read_at: null,
  created_at: "2026-09-01T10:00:00.000Z",
  ...overrides,
});

describe("通知展示整理", () => {
  it("按类型和标题合并重复通知，并保留最新通知作为入口", () => {
    const groups = groupNotifications([
      notification({
        id: "older",
        created_at: "2026-09-01T09:00:00.000Z",
        read_at: "2026-09-01T09:01:00.000Z",
      }),
      notification({ id: "latest", created_at: "2026-09-01T10:00:00.000Z" }),
      notification({ id: "other", type: "risk_alert", title: "发现风险" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      count: 2,
      unreadCount: 1,
      ids: ["latest", "older"],
      notifications: [{ id: "latest" }, { id: "older" }],
    });
    expect(groups[0]?.notification.id).toBe("latest");
  });

  it("同组内存在高优先级通知时提升展示级别", () => {
    const [group] = groupNotifications([
      notification({ id: "normal" }),
      notification({ id: "high", priority: "high", created_at: "2026-09-01T09:00:00.000Z" }),
    ]);

    expect(group?.hasHighPriority).toBe(true);
  });

  it("隐藏工作流正文中的内部 UUID，但保留普通正文", () => {
    expect(getNotificationDisplayBody("content / 123e4567-e89b-12d3-a456-426614174000")).toBe(
      "关联业务对象已更新",
    );
    expect(getNotificationDisplayBody("审批已完成，请查看报告")).toBe("审批已完成，请查看报告");
    expect(getNotificationDisplayBody(null)).toBeNull();
  });
});
