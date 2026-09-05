"use client";

import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { AgentRunFilters } from "./agent-run-filters";
import { AgentRunsTable } from "./agent-runs-table";
import { InfrastructureHealth } from "./infrastructure-health";
import { MonitorOverview } from "./monitor-overview";
import { useAgentMonitorSummary, useAgentRuns } from "../queries";

const FILTER_DEFAULTS = {
  status: "",
  agent_key: "",
  provider: "",
  mode: "",
  anomaly: "",
  date_from: "",
  date_to: "",
};

export function AgentMonitorPage() {
  const router = useRouter();
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();
  const summary = useAgentMonitorSummary();
  const runs = useAgentRuns({
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")),
    cursor: pagination.cursor,
  });

  const handleFilter = (key: keyof typeof FILTER_DEFAULTS, value: string) => {
    setFilter(key, value);
    pagination.resetPages();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent 运行监测"
        description="从业务任务下钻到每一次模型调用，定位失败、慢请求与成本异常。"
        actions={
          <span className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <Activity className="size-3.5 text-success" />运行列表每 5 秒刷新
          </span>
        }
      />

      <AsyncBoundary
        isLoading={summary.isLoading}
        isError={summary.isError}
        error={summary.error}
        onRetry={() => summary.refetch()}
      >
        {summary.data && <MonitorOverview summary={summary.data} />}
      </AsyncBoundary>

      <PermissionGate permission="admin:ai_infrastructure">
        <InfrastructureHealth />
      </PermissionGate>

      <section className="space-y-3" aria-labelledby="agent-runs-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="agent-runs-heading" className="text-lg font-semibold tracking-tight">运行记录</h2>
            <p className="mt-1 text-xs text-muted-foreground">包含工作流内与同步执行的全部 Agent</p>
          </div>
        </div>
        <AgentRunFilters
          filters={filters}
          isFiltered={isFiltered}
          onChange={handleFilter}
          onReset={() => {
            reset();
            pagination.resetPages();
          }}
        />
        <AsyncBoundary
          isLoading={runs.isLoading}
          isError={runs.isError}
          error={runs.error}
          onRetry={() => runs.refetch()}
          isEmpty={runs.data?.items.length === 0}
          filtered={isFiltered}
          emptyTitle={isFiltered ? undefined : "还没有 Agent 运行记录"}
          emptyHint={isFiltered ? undefined : "发起一次策略生成、外联起草或知识问答后，这里会出现逐次运行记录"}
        >
          <AgentRunsTable
            items={runs.data?.items ?? []}
            onOpen={(run) => router.push(`/ai-runs/agents/${run.id}`)}
            pagination={{
              info: runs.data?.pagination,
              page: pagination.page,
              hasPrev: pagination.hasPrev,
              onNext: () => runs.data?.pagination.next_cursor && pagination.next(runs.data.pagination.next_cursor),
              onPrev: pagination.prev,
            }}
          />
        </AsyncBoundary>
      </section>
    </div>
  );
}
