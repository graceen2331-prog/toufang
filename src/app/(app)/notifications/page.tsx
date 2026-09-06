"use client";

import { Suspense } from "react";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { useMarkNotificationsRead, useNotifications } from "@/features/notifications/queries";
import { NOTIFICATION_TYPE_LABELS } from "@/shared/schemas/notification";
import { useUrlFilters } from "@/lib/list-state";

const FILTER_DEFAULTS = { unread: "", type: "" };

export default function NotificationsPage() {
  return (
    <Suspense>
      <NotificationsPageInner />
    </Suspense>
  );
}

function NotificationsPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const notifications = useNotifications({
    unread: filters.unread === "true",
    type: filters.type || undefined,
  });
  const markRead = useMarkNotificationsRead();

  return (
    <div className="space-y-6">
      <PageHeader
        title="通知"
        description="集中查看审批提醒、工作流结果、风险提醒和系统消息。"
        actions={
          <Button variant="outline" onClick={() => markRead.mutate({ all: true })}>
            全部标为已读
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          placeholder="未读"
          value={filters.unread}
          onChange={(value) => setFilter("unread", value)}
          options={[{ value: "true", label: "只看未读" }]}
        />
        <FilterSelect
          placeholder="类型"
          value={filters.type}
          onChange={(value) => setFilter("type", value)}
          options={Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={reset}>
            清除筛选
          </Button>
        )}
      </div>

      <NotificationList
        notifications={notifications.data?.items ?? []}
        isLoading={notifications.isLoading}
        isError={notifications.isError}
        error={notifications.error}
        onRetry={() => notifications.refetch()}
        filtered={isFiltered}
      />
    </div>
  );
}
