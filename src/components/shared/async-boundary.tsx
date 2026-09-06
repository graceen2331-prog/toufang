"use client";

import type { ReactNode } from "react";
import { FileQuestion, Lock, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/api";

interface AsyncBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** 数据加载成功但为空 */
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  /** 空状态是否由筛选导致（展示不同文案图标） */
  filtered?: boolean;
  /** 自定义 loading 骨架；缺省为列表骨架 */
  skeleton?: ReactNode;
  children: ReactNode;
}

/**
 * 四态边界：loading / error(区分权限拒绝) / empty(区分筛选无结果) / 正常内容。
 * 所有列表与详情页共用，禁止在页面里手写重复的状态分支。
 */
export function AsyncBoundary({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyHint,
  emptyAction,
  filtered,
  skeleton,
  children,
}: AsyncBoundaryProps) {
  if (isLoading) {
    return <>{skeleton ?? <ListSkeleton />}</>;
  }

  if (isError) {
    const isPermission = error instanceof ApiClientError && error.code === "PERMISSION_DENIED";
    return (
      <StatePanel
        icon={isPermission ? Lock : RefreshCw}
        title={isPermission ? "没有访问权限" : "加载失败"}
        hint={
          isPermission
            ? (error instanceof ApiClientError ? error.message : "请联系管理员申请权限")
            : error instanceof ApiClientError
              ? error.message
              : "网络或服务异常，请重试"
        }
        action={
          !isPermission && onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="size-3.5" />
              重试
            </Button>
          ) : null
        }
      />
    );
  }

  if (isEmpty) {
    return (
      <StatePanel
        icon={filtered ? SearchX : FileQuestion}
        title={emptyTitle ?? (filtered ? "没有匹配的结果" : "暂无数据")}
        hint={emptyHint ?? (filtered ? "尝试放宽或清除筛选条件" : undefined)}
        action={emptyAction}
      />
    );
  }

  return <>{children}</>;
}

function StatePanel({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: typeof Lock;
  title: string;
  hint?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
      <Icon className="size-8 text-muted-foreground/50" />
      <p className="mt-3 font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
