"use client";

import { Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusTag } from "@/components/shared/status-tag";
import { useAiUsage, useWorkflowRuns } from "@/features/workflows/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { WORKFLOW_RUN_STATUS } from "@/shared/constants/status";
import {
  formatCost,
  WORKFLOW_KEY_LABELS,
  type WorkflowRunListItemDto,
} from "@/shared/schemas/workflow";

const FILTER_DEFAULTS = { status: "", workflow_key: "" };

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  campaign: "Campaign",
  creator: "达人",
  brand: "品牌",
};

export default function AiRunsPage() {
  return (
    <Suspense>
      <AiRunsPageInner />
    </Suspense>
  );
}

function AiRunsPageInner() {
  const router = useRouter();
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();

  const { data: usage } = useAiUsage();
  const { data, isLoading, isError, error, refetch } = useWorkflowRuns({
    status: filters.status || undefined,
    workflow_key: filters.workflow_key || undefined,
    cursor: pagination.cursor,
  });

  const monthCalls = useMemo(
    () => (usage?.by_agent ?? []).reduce((sum, a) => sum + a.calls, 0),
    [usage],
  );

  const columns = useMemo<ColumnDef<WorkflowRunListItemDto, unknown>[]>(
    () => [
      {
        header: "工作流",
        cell: ({ row }) => (
          <span className="font-medium">
            {WORKFLOW_KEY_LABELS[row.original.workflow_key] ?? row.original.workflow_key}
          </span>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => <StatusTag source={WORKFLOW_RUN_STATUS} value={row.original.status} />,
      },
      {
        header: "主体",
        cell: ({ row }) =>
          row.original.subject_type && row.original.subject_id ? (
            <span className="text-sm">
              {SUBJECT_TYPE_LABELS[row.original.subject_type] ?? row.original.subject_type}
              <span className="ml-1 font-mono text-xs text-muted-foreground">
                {row.original.subject_id.slice(0, 8)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: "步骤数",
        cell: ({ row }) => <span className="tabular-nums">{row.original.step_count}</span>,
      },
      {
        header: "Agent 数",
        cell: ({ row }) => <span className="tabular-nums">{row.original.agent_run_count}</span>,
      },
      {
        header: "失败原因",
        cell: ({ row }) =>
          row.original.failure_reason ? (
            <span
              className="block max-w-48 truncate text-sm text-destructive"
              title={row.original.failure_reason}
            >
              {row.original.failure_reason}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: "创建时间",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {format(new Date(row.original.created_at), "MM-dd HH:mm")}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 运行监控"
        description="查看 AI 工作流运行记录、成本消耗与各 Agent 用量。"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="本月预算"
          value={
            usage ? `¥${(usage.month_budget_cents / 100).toLocaleString("zh-CN")}` : "—"
          }
        />
        <MetricCard
          label="本月已用"
          value={usage ? formatCost(usage.month_spent_microcents) : "—"}
        />
        <MetricCard label="本月调用次数" value={usage ? monthCalls.toLocaleString("zh-CN") : "—"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          placeholder="状态"
          value={filters.status}
          onChange={(v) => {
            setFilter("status", v);
            pagination.resetPages();
          }}
          options={Object.entries(WORKFLOW_RUN_STATUS.states).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <FilterSelect
          placeholder="工作流类型"
          value={filters.workflow_key}
          onChange={(v) => {
            setFilter("workflow_key", v);
            pagination.resetPages();
          }}
          options={Object.entries(WORKFLOW_KEY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
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
        filtered={isFiltered}
        emptyTitle={isFiltered ? undefined : "还没有工作流运行记录"}
        emptyHint={isFiltered ? undefined : "在 Campaign 详情页发起「AI 生成策略」等工作流后，这里会展示运行记录"}
      >
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          onRowClick={(row) => router.push(`/ai-runs/${row.id}`)}
          pagination={{
            info: data?.pagination,
            page: pagination.page,
            hasPrev: pagination.hasPrev,
            onNext: () =>
              data?.pagination.next_cursor && pagination.next(data.pagination.next_cursor),
            onPrev: pagination.prev,
          }}
        />
      </AsyncBoundary>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">本月用量（按 Agent）</CardTitle>
        </CardHeader>
        <CardContent>
          {!usage || usage.by_agent.length === 0 ? (
            <p className="text-sm text-muted-foreground">本月暂无 Agent 调用记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">调用次数</TableHead>
                  <TableHead className="text-right">输入 tokens</TableHead>
                  <TableHead className="text-right">输出 tokens</TableHead>
                  <TableHead className="text-right">成本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.by_agent.map((agent) => (
                  <TableRow key={agent.agent_key}>
                    <TableCell className="font-medium">{agent.agent_key}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {agent.calls.toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {agent.input_tokens.toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {agent.output_tokens.toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCost(agent.cost_microcents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
