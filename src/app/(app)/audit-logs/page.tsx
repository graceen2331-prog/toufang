"use client";

import { Suspense } from "react";
import { Search } from "lucide-react";
import { AuditLogTable } from "@/features/audit-logs/components/audit-log-table";
import { useAuditLogs } from "@/features/audit-logs/queries";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";

const FILTER_DEFAULTS = { action: "", entity_type: "", date_from: "", date_to: "" };

export default function AuditLogsPage() {
  return (
    <Suspense>
      <AuditLogsPageInner />
    </Suspense>
  );
}

function AuditLogsPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const logs = useAuditLogs({
    ...filters,
    cursor: pagination.cursor,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="审计日志" description="查看用户、系统和 Agent 的关键操作记录。" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute top-2 left-2 size-4 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            value={filters.action}
            onChange={(event) => {
              setFilter("action", event.target.value);
              pagination.resetPages();
            }}
            placeholder="搜索 action"
          />
        </div>
        <FilterSelect
          placeholder="对象"
          value={filters.entity_type}
          onChange={(value) => {
            setFilter("entity_type", value);
            pagination.resetPages();
          }}
          options={[
            { value: "campaign", label: "Campaign" },
            { value: "knowledge_document", label: "知识文档" },
            { value: "workflow_run", label: "工作流" },
            { value: "user", label: "用户" },
          ]}
        />
        <Input
          type="date"
          className="h-8 w-auto"
          value={filters.date_from}
          onChange={(event) => {
            setFilter("date_from", event.target.value);
            pagination.resetPages();
          }}
          aria-label="开始日期"
        />
        <Input
          type="date"
          className="h-8 w-auto"
          value={filters.date_to}
          onChange={(event) => {
            setFilter("date_to", event.target.value);
            pagination.resetPages();
          }}
          aria-label="结束日期"
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
      <AuditLogTable
        logs={logs.data?.items ?? []}
        isLoading={logs.isLoading}
        isError={logs.isError}
        error={logs.error}
        onRetry={() => logs.refetch()}
        filtered={isFiltered}
        pagination={{
          info: logs.data?.pagination,
          page: pagination.page,
          hasPrev: pagination.hasPrev,
          onNext: () => logs.data?.pagination.next_cursor && pagination.next(logs.data.pagination.next_cursor),
          onPrev: pagination.prev,
        }}
      />
    </div>
  );
}
