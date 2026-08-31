import type { NotificationDto } from "@/shared/schemas/notification";

const INTERNAL_REFERENCE_PATTERN = /^\S+\s*\/\s*[0-9a-f-]{20,}$/i;

export interface NotificationGroup {
  key: string;
  notification: NotificationDto;
  notifications: NotificationDto[];
  ids: string[];
  count: number;
  unreadCount: number;
  hasHighPriority: boolean;
}

/** 将工作流重复提醒合并成一张卡片，避免通知列表被同类消息淹没。 */
export function groupNotifications(notifications: NotificationDto[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();

  const sorted = [...notifications].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );

  for (const notification of sorted) {
    const key = `${notification.type}\u0000${notification.title}`;
    const current = groups.get(key);

    if (current) {
      current.notifications.push(notification);
      current.ids.push(notification.id);
      current.count += 1;
      current.unreadCount += notification.read_at ? 0 : 1;
      current.hasHighPriority ||= notification.priority === "high";
      continue;
    }

    groups.set(key, {
      key,
      notification,
      notifications: [notification],
      ids: [notification.id],
      count: 1,
      unreadCount: notification.read_at ? 0 : 1,
      hasHighPriority: notification.priority === "high",
    });
  }

  return [...groups.values()];
}

/** 隐藏通知正文中的内部 subject/id，避免把 UUID 直接暴露给用户。 */
export function getNotificationDisplayBody(body: string | null): string | null {
  if (!body) return body;
  return INTERNAL_REFERENCE_PATTERN.test(body.trim()) ? "关联业务对象已更新" : body;
}
