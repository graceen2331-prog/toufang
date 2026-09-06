"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CheckCheck } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NOTIFICATION_TYPE_LABELS, type NotificationDto } from "@/shared/schemas/notification";
import { useMarkNotificationsRead } from "@/features/notifications/queries";
import {
  getNotificationDisplayBody,
  groupNotifications,
} from "@/features/notifications/group-notifications";

export function NotificationList({
  notifications,
  isLoading,
  isError,
  error,
  onRetry,
  filtered,
}: {
  notifications: NotificationDto[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  filtered: boolean;
}) {
  const markRead = useMarkNotificationsRead();
  const groups = groupNotifications(notifications);

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      isEmpty={groups.length === 0}
      filtered={filtered}
      emptyTitle={filtered ? "没有匹配的通知" : "暂无通知"}
      emptyHint={filtered ? "切换筛选条件查看其它通知" : "审批、工作流和系统提醒会出现在这里"}
    >
      <div className="space-y-3">
        {groups.map((group) => {
          const notification = group.notification;
          const isUnread = group.unreadCount > 0;

          return (
            <Card key={group.key} className={isUnread ? "py-4" : "py-4 opacity-75"}>
              <CardContent className="flex items-start justify-between gap-4 px-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={group.hasHighPriority ? "destructive" : "secondary"}>
                      {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}
                    </Badge>
                    {isUnread && <Badge variant="outline">未读</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(notification.created_at), "MM-dd HH:mm")}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    {group.count > 1 && (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {group.count} 条同类通知
                        {group.unreadCount > 0 ? `，${group.unreadCount} 条未读` : ""}
                      </p>
                    )}
                    {getNotificationDisplayBody(notification.body) && (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {getNotificationDisplayBody(notification.body)}
                      </p>
                    )}
                    {group.count > 1 && (
                      <details className="text-sm text-muted-foreground">
                        <summary className="cursor-pointer select-none hover:text-foreground">
                          展开查看全部 {group.count} 条通知
                        </summary>
                        <ul className="mt-2 space-y-1 border-l pl-3">
                          {group.notifications.map((item) => (
                            <li key={item.id}>
                              <Link
                                href={item.link_url ?? "/notifications"}
                                className="hover:text-foreground hover:underline"
                              >
                                {format(new Date(item.created_at), "MM-dd HH:mm")} · {item.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  {notification.link_url && (
                    <Button variant="link" className="h-auto px-0" asChild>
                      <Link href={notification.link_url}>打开关联页面</Link>
                    </Button>
                  )}
                </div>
                {isUnread && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markRead.mutate({ ids: group.ids })}
                  >
                    <CheckCheck className="size-4" />
                    已读
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AsyncBoundary>
  );
}
