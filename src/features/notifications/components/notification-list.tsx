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

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      isEmpty={notifications.length === 0}
      filtered={filtered}
      emptyTitle={filtered ? "没有匹配的通知" : "暂无通知"}
      emptyHint={filtered ? "切换筛选条件查看其它通知" : "审批、工作流和系统提醒会出现在这里"}
    >
      <div className="space-y-3">
        {notifications.map((notification) => (
          <Card key={notification.id} className={notification.read_at ? "py-4 opacity-75" : "py-4"}>
            <CardContent className="flex items-start justify-between gap-4 px-4">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={notification.priority === "high" ? "destructive" : "secondary"}>
                    {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}
                  </Badge>
                  {!notification.read_at && <Badge variant="outline">未读</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(notification.created_at), "MM-dd HH:mm")}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p>
                  )}
                </div>
                {notification.link_url && (
                  <Button variant="link" className="h-auto px-0" asChild>
                    <Link href={notification.link_url}>打开关联页面</Link>
                  </Button>
                )}
              </div>
              {!notification.read_at && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markRead.mutate({ ids: [notification.id] })}
                >
                  <CheckCheck className="size-4" />
                  已读
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AsyncBoundary>
  );
}
