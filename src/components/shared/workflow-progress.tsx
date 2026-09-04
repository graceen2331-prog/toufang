"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/shared/status-tag";
import { useWorkflowRun, workflowKeys } from "@/features/workflows/queries";
import { WORKFLOW_RUN_STATUS, WORKFLOW_STEP_STATUS } from "@/shared/constants/status";
import { STEP_KEY_LABELS, WORKFLOW_KEY_LABELS } from "@/shared/schemas/workflow";

/** 工作流终态：到达后关闭 SSE 并触发 onFinished */
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

interface WorkflowSseEvent {
  type: "run_status" | "step_status" | "heartbeat";
  run_id: string;
  status?: string;
  step_key?: string;
  step_status?: string;
  at: string;
}

/**
 * 工作流进度：初始快照走 useWorkflowRun，实时更新走 SSE。
 * SSE 事件到达时 invalidate 详情 query，由 TanStack Query 重新拉取快照渲染。
 */
export function WorkflowProgress({
  runId,
  onFinished,
  inlineApproval = false,
}: {
  runId: string;
  onFinished?: (status: string) => void;
  inlineApproval?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: run } = useWorkflowRun(runId);
  // onFinished 放 ref，避免调用方每次渲染传新函数导致 SSE 重连
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const source = new EventSource(`/api/v1/workflow-runs/${runId}/events`);
    let finished = false;

    source.onmessage = (message) => {
      let event: WorkflowSseEvent;
      try {
        event = JSON.parse(message.data as string) as WorkflowSseEvent;
      } catch {
        return;
      }
      if (event.type === "heartbeat") return;
      void queryClient.invalidateQueries({ queryKey: workflowKeys.detail(runId) });
      if (
        event.type === "run_status" &&
        event.status &&
        TERMINAL_STATUSES.has(event.status) &&
        !finished
      ) {
        finished = true;
        onFinishedRef.current?.(event.status);
        source.close();
      }
    };

    return () => {
      source.close();
    };
  }, [runId, queryClient]);

  if (!run) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在加载运行状态…
      </p>
    );
  }

  const steps = [...run.steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {WORKFLOW_KEY_LABELS[run.workflow_key] ?? run.workflow_key}
        </span>
        <StatusTag source={WORKFLOW_RUN_STATUS} value={run.status} />
      </div>

      {run.failure_reason && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          失败原因：{run.failure_reason}
        </p>
      )}

      {run.pending_checkpoint_id && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/30 bg-warning/15 p-3 text-sm">
          <ShieldCheck className="size-4 shrink-0" />
          <span className="flex-1">
            {inlineApproval
              ? "工作流已暂停，等待人工审批；请在当前 Campaign 的待办栏处理后继续执行。"
              : "工作流已暂停，等待人工审批后继续执行。"}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href="/approvals">前往审批中心</Link>
          </Button>
        </div>
      )}

      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-card text-xs tabular-nums text-muted-foreground">
              {step.status === "running" ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                step.step_order
              )}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">
              {STEP_KEY_LABELS[step.step_key] ?? step.step_key}
            </span>
            <StatusTag source={WORKFLOW_STEP_STATUS} value={step.status} />
          </li>
        ))}
      </ol>
    </div>
  );
}
