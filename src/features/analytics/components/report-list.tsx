"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { StatusTag } from "@/components/shared/status-tag";
import { REPORT_STATUS } from "@/shared/constants/status";
import type { ReportDto } from "@/shared/schemas/content-analytics";
import type { ApiPagination } from "@/lib/api";

export function ReportList({
  reports,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  pagination,
}: {
  reports: ReportDto[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onSelect: (id: string) => void;
  pagination: {
    info: ApiPagination | undefined;
    page: number;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
  };
}) {
  const columns = useMemo<ColumnDef<ReportDto, unknown>[]>(
    () => [
      {
        header: "报告",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{row.original.kind}</div>
          </div>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => <StatusTag source={REPORT_STATUS} value={row.original.status} />,
      },
      {
        header: "更新时间",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {format(new Date(row.original.updated_at), "MM-dd HH:mm")}
          </span>
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
      isEmpty={reports.length === 0}
      emptyTitle="暂无报告"
      emptyHint="生成分析工作流或创建复盘后会出现在这里"
    >
      <DataTable columns={columns} data={reports} onRowClick={(row) => onSelect(row.id)} pagination={pagination} />
    </AsyncBoundary>
  );
}
