"use client";

import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { PageHeader } from "@/components/shared/page-header";
import { ApprovalCard } from "@/features/approvals/components/approval-card";
import { useApprovals } from "@/features/approvals/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { CHECKPOINT_STATUS } from "@/shared/constants/status";
import { CHECKPOINT_TYPE_LABELS } from "@/shared/schemas/checkpoint";

const FILTER_DEFAULTS = { status: "pending", type: "", assignee: "", overdue: "" };

export default function ApprovalsPage() {
  return (
    <Suspense>
      <ApprovalsPageInner />
    </Suspense>
  );
}

function ApprovalsPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();

  const { data, isLoading, isError, error, refetch } = useApprovals({
    status: filters.status === "all" ? undefined : filters.status,
    type: filters.type || undefined,
    assignee: filters.assignee || undefined,
    overdue: filters.overdue === "true" ? true : undefined,
    cursor: pagination.cursor,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="审批中心"
        description="AI 工作流与人工操作触发的审批门：外发、合同、付款、报告等关键动作都需要在此确认。"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status}
          onValueChange={(v) => {
            setFilter("status", v);
            pagination.resetPages();
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">状态（全部）</SelectItem>
            {Object.entries(CHECKPOINT_STATUS).map(([value, meta]) => (
              <SelectItem key={value} value={value}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterSelect
          placeholder="类型"
          value={filters.type}
          onChange={(v) => {
            setFilter("type", v);
            pagination.resetPages();
          }}
          options={Object.entries(CHECKPOINT_TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <FilterSelect
          placeholder="处理范围"
          value={filters.assignee}
          onChange={(v) => { setFilter("assignee", v); pagination.resetPages(); }}
          options={[{ value: "me", label: "待我处理" }, { value: "unassigned", label: "未分配" }]}
        />
        <FilterSelect
          placeholder="时效"
          value={filters.overdue}
          onChange={(v) => { setFilter("overdue", v); pagination.resetPages(); }}
          options={[{ value: "true", label: "已逾期" }]}
        />
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              pagination.resetPages();
            }}
          >
            清除筛选
          </Button>
        )}
      </div>

      <AsyncBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={data?.items.length === 0}
        filtered={filters.type !== "" || filters.status !== "pending" || filters.assignee !== "" || filters.overdue !== ""}
        emptyTitle="暂无待审批事项"
        emptyHint="AI 工作流触发审批后会出现在这里"
      >
        <div className="space-y-3">
          {(data?.items ?? []).map((checkpoint) => (
            <ApprovalCard key={checkpoint.id} checkpoint={checkpoint} />
          ))}
        </div>
      </AsyncBoundary>

      {(pagination.hasPrev || data?.pagination.has_more) && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">第 {pagination.page} 页</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrev}
            onClick={pagination.prev}
          >
            <ChevronLeft className="size-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.pagination.has_more}
            onClick={() => data?.pagination.next_cursor && pagination.next(data.pagination.next_cursor)}
          >
            下一页
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}（全部）</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
