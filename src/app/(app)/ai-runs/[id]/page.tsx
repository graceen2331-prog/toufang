"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AlertTriangle, RotateCcw, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsyncBoundary, DetailSkeleton } from "@/components/shared/async-boundary";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { WorkflowProgress } from "@/components/shared/workflow-progress";
import {
  useCancelWorkflow,
  useRetryWorkflow,
  useWorkflowExecutionHealth,
  useWorkflowRun,
} from "@/features/workflows/queries";
import { AGENT_RUN_STATUS, WORKFLOW_RUN_STATUS } from "@/shared/constants/status";
import { formatCost, WORKFLOW_KEY_LABELS } from "@/shared/schemas/workflow";

/** 可取消的运行状态 */
const CANCELLABLE_STATUSES = ["queued", "running", "waiting_for_human"];
const HEALTH_RELEVANT_STATUSES = ["queued", "retrying", "running"];

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const seconds = (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  return `${seconds.toFixed(1)}s`;
}

export default function AiRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: run, isLoading, isError, error, refetch } = useWorkflowRun(id);
  const health = useWorkflowExecutionHealth(
    id,
    HEALTH_RELEVANT_STATUSES.includes(run?.status ?? ""),
  );
  const retry = useRetryWorkflow();
  const cancel = useCancelWorkflow();
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<DetailSkeleton />}
    >
      {run && (
        <div className="space-y-6">
          <PageHeader
            title={
              <span className="flex items-center gap-3">
                {WORKFLOW_KEY_LABELS[run.workflow_key] ?? run.workflow_key}
                <StatusTag source={WORKFLOW_RUN_STATUS} value={run.status} />
              </span>
            }
            description={`运行 ID：${run.id} · 创建于 ${format(new Date(run.created_at), "yyyy-MM-dd HH:mm:ss")}`}
            actions={
              <PermissionGate permission="ai:run">
                <span className="flex items-center gap-2">
                  {run.can_retry && (
                    <Button
                      variant="outline"
                      disabled={retry.isPending}
                      onClick={() =>
                        retry.mutate(run.id, {
                          onSuccess: (result) => router.push(`/ai-runs/${result.workflow_run_id}`),
                        })
                      }
                    >
                      <RotateCcw className="size-4" />
                      {retry.isPending ? "重试中…" : "重试"}
                    </Button>
                  )}
                  {run.retried_by_run_id && (
                    <Button variant="outline" asChild>
                      <Link href={`/ai-runs/${run.retried_by_run_id}`}>查看重试运行</Link>
                    </Button>
                  )}
                  {CANCELLABLE_STATUSES.includes(run.status) && (
                    <Button variant="outline" onClick={() => setCancelOpen(true)}>
                      <XCircle className="size-4" />
                      取消
                    </Button>
                  )}
                </span>
              </PermissionGate>
            }
          />

          {health.data && ["degraded", "offline", "unavailable"].includes(health.data.status) && (
            <Alert variant={health.data.status === "offline" ? "destructive" : "default"}>
              <AlertTriangle />
              <AlertTitle>执行服务状态异常</AlertTitle>
              <AlertDescription>{health.data.message}</AlertDescription>
            </Alert>
          )}

          {(run.retry_of_run_id || run.retried_by_run_id || run.retry_blocked_reason) && (
            <Alert>
              <RotateCcw />
              <AlertTitle>重试记录</AlertTitle>
              <AlertDescription>
                {run.retry_of_run_id && (
                  <span>
                    本运行由 <Link href={`/ai-runs/${run.retry_of_run_id}`}>上一次失败运行</Link> 新建。
                  </span>
                )}
                {run.retried_by_run_id && (
                  <span>
                    已生成 <Link href={`/ai-runs/${run.retried_by_run_id}`}>新的重试运行</Link>，当前记录保持终态。
                  </span>
                )}
                {!run.retry_of_run_id && !run.retried_by_run_id && run.retry_blocked_reason}
              </AlertDescription>
            </Alert>
          )}

          <ConfirmDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title="确认取消该工作流？"
            description="取消后运行将终止，已产生的成本不会退还，可重新发起工作流。"
            confirmLabel="确认取消"
            pending={cancel.isPending}
            onConfirm={() => cancel.mutate(run.id, { onSuccess: () => setCancelOpen(false) })}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">执行进度</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowProgress runId={run.id} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="成本" value={formatCost(run.cost_microcents)} />
            <MetricCard label="输入 tokens" value={run.input_tokens.toLocaleString("zh-CN")} />
            <MetricCard label="输出 tokens" value={run.output_tokens.toLocaleString("zh-CN")} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent 运行</CardTitle>
            </CardHeader>
            <CardContent>
              {run.agent_runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无 Agent 运行记录</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead>模型</TableHead>
                      <TableHead className="text-right">时长</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.agent_runs.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.agent_key}</TableCell>
                        <TableCell>
                          <StatusTag source={AGENT_RUN_STATUS} value={agent.status} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {agent.prompt_key
                            ? `${agent.prompt_key}@${agent.prompt_version ?? "?"}`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{agent.model ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(agent.started_at, agent.completed_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">输入 / 输出</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  输入（input）
                </summary>
                <pre className="max-h-80 overflow-auto border-t bg-muted/40 p-3 text-xs">
                  {JSON.stringify(run.input, null, 2)}
                </pre>
              </details>
              <details className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  输出（output）
                </summary>
                <pre className="max-h-80 overflow-auto border-t bg-muted/40 p-3 text-xs">
                  {JSON.stringify(run.output, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </div>
      )}
    </AsyncBoundary>
  );
}
