import "server-only";
import { type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import type { Notification } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import type { NotificationDto, NotificationMarkReadInput } from "@/shared/schemas/notification";
import { notificationRepository, type NotificationListParams } from "./notification.repository";

function toDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link_url: notification.linkUrl,
    priority: notification.priority,
    read_at: notification.readAt?.toISOString() ?? null,
    created_at: notification.createdAt.toISOString(),
  };
}

export async function listNotifications(
  ctx: TenantCtx,
  params: NotificationListParams,
): Promise<{ items: NotificationDto[]; pagination: Pagination }> {
  const rows = await notificationRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(toDto), pagination };
}

export async function countUnreadNotifications(ctx: TenantCtx): Promise<number> {
  return notificationRepository.countUnread(ctx);
}

export async function markNotificationsRead(
  ctx: TenantCtx,
  input: NotificationMarkReadInput,
): Promise<{ updated: number }> {
  if (input.all) {
    return { updated: await notificationRepository.markAllRead(ctx) };
  }
  const ids = input.ids ?? [];
  if (ids.length === 0) return { updated: 0 };
  return { updated: await notificationRepository.markRead(ctx, ids) };
}

export async function createNotificationForUser(input: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  priority?: string;
}): Promise<void> {
  await notificationRepository.createForUser(
    { orgId: input.tenantId },
    input.userId,
    {
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkUrl: input.linkUrl ?? null,
      priority: input.priority ?? "normal",
    },
  );
}

export async function notifyRole(input: {
  tenantId: string;
  roleKey: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  priority?: string;
}): Promise<void> {
  const userIds = await notificationRepository.findActiveUsersByRole(input.tenantId, input.roleKey);
  await Promise.all(
    userIds.map((userId) =>
      createNotificationForUser({
        tenantId: input.tenantId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
        priority: input.priority,
      }),
    ),
  );
}
