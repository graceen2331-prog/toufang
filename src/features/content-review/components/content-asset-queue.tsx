"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { StatusTag } from "@/components/shared/status-tag";
import { CONTENT_ASSET_STATUS } from "@/shared/constants/status";
import type { ContentAssetDto } from "@/shared/schemas/content-analytics";
import type { ApiPagination } from "@/lib/api";

export function ContentAssetQueue({
  items,
  isLoading,
  isError,
  error,
  onRetry,
  selectedId,
  onSelect,
  pagination,
}: {
  items: ContentAssetDto[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  pagination: {
    info: ApiPagination | undefined;
    page: number;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
  };
}) {
  const columns = useMemo<ColumnDef<ContentAssetDto, unknown>[]>(
    () => [
      {
        header: "内容 / 达人",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.title ?? "未命名内容"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {row.original.campaign_name} · {row.original.creator_name}
            </div>
          </div>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => <StatusTag source={CONTENT_ASSET_STATUS} value={row.original.status} />,
      },
      {
        header: "平台",
        cell: ({ row }) => <span className="text-sm">{row.original.platform ?? "未标注"}</span>,
      },
      {
        header: "提交时间",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {format(new Date(row.original.created_at), "MM-dd HH:mm")}
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
      isEmpty={items.length === 0}
      emptyTitle="暂无待审内容"
      emptyHint="提交达人内容后会出现在这里"
    >
      <DataTable
        columns={columns}
        data={items}
        onRowClick={(row) => onSelect(row.id)}
        pagination={pagination}
      />
      {selectedId && <p className="mt-2 text-xs text-muted-foreground">当前选择：{selectedId.slice(-8)}</p>}
    </AsyncBoundary>
  );
}
