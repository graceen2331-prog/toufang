"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import type { AuditLogDto } from "@/shared/schemas/audit-log";
import type { ApiPagination } from "@/lib/api";

export function AuditLogTable({
  logs,
  isLoading,
  isError,
  error,
  onRetry,
  filtered,
  pagination,
}: {
  logs: AuditLogDto[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  filtered: boolean;
  pagination: {
    info: ApiPagination | undefined;
    page: number;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
  };
}) {
  const columns = useMemo<ColumnDef<AuditLogDto, unknown>[]>(
    () => [
      {
        header: "时间",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {format(new Date(row.original.created_at), "MM-dd HH:mm:ss")}
          </span>
        ),
      },
      {
        header: "操作者",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.actor_name ?? row.original.actor_type}</div>
            <div className="text-xs text-muted-foreground">{row.original.actor_id ?? "system"}</div>
          </div>
        ),
      },
      {
        header: "动作",
        cell: ({ row }) => <Badge variant="secondary">{row.original.action}</Badge>,
      },
      {
        header: "对象",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.entity_type ?? "—"} {row.original.entity_id ? `/${row.original.entity_id.slice(-8)}` : ""}
          </span>
        ),
      },
      {
        header: "Request ID",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.request_id?.slice(0, 8) ?? "—"}</span>
        ),
      },
    ],
    [],
  );

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      isEmpty={logs.length === 0}
      filtered={filtered}
      emptyTitle={filtered ? "没有匹配的审计记录" : "暂无审计记录"}
      emptyHint={filtered ? "调整筛选条件后重试" : "系统写操作会自动沉淀审计日志"}
    >
      <DataTable columns={columns} data={logs} pagination={pagination} />
    </AsyncBoundary>
  );
}
