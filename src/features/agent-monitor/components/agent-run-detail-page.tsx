"use client";

import { useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AsyncBoundary, DetailSkeleton } from "@/components/shared/async-boundary";
import { PageHeader } from "@/components/shared/page-header";
import { StatusTag } from "@/components/shared/status-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENT_RUN_STATUS, WORKFLOW_STEP_STATUS } from "@/shared/constants/status";
import { AGENT_ERROR_LABELS, AGENT_KEY_LABELS } from "@/shared/schemas/agent-monitor";
import { STEP_KEY_LABELS, WORKFLOW_KEY_LABELS } from "@/shared/schemas/workflow";
import { agentMonitorKeys, useAgentRun } from "../queries";
import { AgentCallTable } from "./agent-call-table";
import { AgentRunMetrics } from "./agent-run-metrics";
import { AgentRunTimeline } from "./agent-run-timeline";
import { TraceContentPanel } from "./trace-content-panel";

export function AgentRunDetailPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const query = useAgentRun(id);
  const runStatus = query.data?.status;

  useEffect(() => {
    if (runStatus && runStatus !== "running") return;
    const source = new EventSource(`/api/v1/agent-runs/${id}/events`);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data as string) as { type: string; status?: string };
        if (event.type === "heartbeat") return;
        void queryClient.invalidateQueries({ queryKey: agentMonitorKeys.detail(id) });
        if (event.type === "run_status" && event.status && ["completed", "failed"].includes(event.status)) {
          source.close();
        }
      } catch {
        // 忽略坏事件
      }
    };
    return () => source.close();
  }, [id, runStatus, queryClient]);

  return (
    <AsyncBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => query.refetch()}
      skeleton={<DetailSkeleton />}
    >
      {query.data && <AgentRunDetailContent run={query.data} />}
    </AsyncBoundary>
  );
}

function AgentRunDetailContent({ run }: { run: NonNullable<ReturnType<typeof useAgentRun>["data"]> }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {AGENT_KEY_LABELS[run.agent_key] ?? run.agent_key}
            <StatusTag source={AGENT_RUN_STATUS} value={run.status} />
          </span>
        }
        description={`运行 ID：${run.id} · ${format(new Date(run.started_at), "yyyy-MM-dd HH:mm:ss")}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/ai-runs"><ArrowLeft className="size-3.5" />返回运行监测</Link>
          </Button>
        }
      />

      {run.failure_reason && (
        <div className="rounded-md border border-destructive/25 bg-destructive/[0.06] px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            {run.error_type ? (AGENT_ERROR_LABELS[run.error_type] ?? run.error_type) : "运行失败"}
          </p>
          <p className="mt-1 text-xs text-destructive/85">{run.failure_reason}</p>
        </div>
      )}

      <AgentRunMetrics run={run} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
        <AgentRunTimeline items={run.timeline} />
        <Card className="py-0">
          <CardHeader className="border-b px-5 py-4"><CardTitle className="text-base">运行上下文</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5 text-sm">
            <ContextRow label="运行方式" value={run.mode === "workflow" ? "工作流" : "同步调用"} />
            <ContextRow label="Prompt" value={run.prompt_key ? `${run.prompt_key}@${run.prompt_version ?? "?"}` : "—"} mono />
            <ContextRow label="Provider / 模型" value={`${run.provider ?? "—"} / ${run.model ?? "—"}`} mono />
            <ContextRow label="业务主体" value={run.subject_type ? `${run.subject_type}${run.subject_id ? ` · ${run.subject_id.slice(0, 12)}` : ""}` : "未关联"} />
            <ContextRow label="发起人" value={run.actor ? `${run.actor.name} · ${run.actor.email}` : "系统"} />
            {run.workflow && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/ai-runs/${run.workflow.id}`}>
                  查看{WORKFLOW_KEY_LABELS[run.workflow.key] ?? run.workflow.key}工作流
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {run.workflow && (
        <Card className="py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-base">所属工作流步骤</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 p-5">
            {run.workflow.steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span className="font-medium">{STEP_KEY_LABELS[step.key] ?? step.key}</span>
                <StatusTag source={WORKFLOW_STEP_STATUS} value={step.status} />
                {step.attempt > 1 && <Badge variant="outline">{step.attempt} 次</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AgentCallTable calls={run.calls} />
      <TraceContentPanel run={run} />
    </div>
  );
}

function ContextRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1 text-xs"}>{value}</p>
    </div>
  );
}
