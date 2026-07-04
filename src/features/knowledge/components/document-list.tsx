"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Archive, RefreshCw } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { Button } from "@/components/ui/button";
import { KNOWLEDGE_DOCUMENT_STATUS } from "@/shared/constants/status";
import type { KnowledgeDocumentDto } from "@/shared/schemas/knowledge";
import type { ApiPagination } from "@/lib/api";
import {
  useDeleteKnowledgeDocument,
  useReindexKnowledgeDocument,
} from "@/features/knowledge/queries";

const TYPE_LABELS: Record<string, string> = {
  document: "文档",
  brief: "Brief",
  report: "报告",
  research: "研究",
  summary: "摘要",
  sop: "SOP",
  note: "笔记",
};

export function DocumentList({
  documents,
  isLoading,
  isError,
  error,
  onRetry,
  filtered,
  pagination,
  emptyAction,
}: {
  documents: KnowledgeDocumentDto[];
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
  emptyAction: React.ReactNode;
}) {
  const remove = useDeleteKnowledgeDocument();
  const reindex = useReindexKnowledgeDocument();
  const columns = useMemo<ColumnDef<KnowledgeDocumentDto, unknown>[]>(
    () => [
      {
        header: "文档",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {TYPE_LABELS[row.original.type] ?? row.original.type} · {row.original.chunk_count} 个片段
            </div>
          </div>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => <StatusTag source={KNOWLEDGE_DOCUMENT_STATUS} value={row.original.status} />,
      },
      {
        header: "可见性",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.visibility}</span>,
      },
      {
        header: "更新时间",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {format(new Date(row.original.updated_at), "MM-dd HH:mm")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <PermissionGate permission="knowledge:write">
            <div className="flex justify-end gap-1">
              {["ready", "failed"].includes(row.original.status) && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="重新索引"
                  onClick={(event) => {
                    event.stopPropagation();
                    reindex.mutate(row.original.id);
                  }}
                >
                  <RefreshCw className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="归档"
                onClick={(event) => {
                  event.stopPropagation();
                  remove.mutate(row.original.id);
                }}
              >
                <Archive className="size-4" />
              </Button>
            </div>
          </PermissionGate>
        ),
      },
    ],
    [remove, reindex],
  );

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      isEmpty={documents.length === 0}
      filtered={filtered}
      emptyTitle={filtered ? "没有匹配的知识文档" : "知识库为空"}
      emptyHint={filtered ? "清除筛选后查看全部文档" : "上传品牌资料、复盘报告或 SOP 后即可提问。"}
      emptyAction={emptyAction}
    >
      <DataTable columns={columns} data={documents} pagination={pagination} />
    </AsyncBoundary>
  );
}
