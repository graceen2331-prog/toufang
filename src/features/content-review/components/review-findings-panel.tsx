"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Check, ClockAlert, ExternalLink, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useDecideApproval } from "@/features/approvals/queries";
import {
  contentReviewKeys,
  useRewriteContentAsset,
  useStartContentReview,
} from "@/features/content-review/queries";
import { useCancelWorkflow, useWorkflowRun } from "@/features/workflows/queries";
import type { ContentAssetDto, ContentReviewFindingDto } from "@/shared/schemas/content-analytics";

const severityLabel: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

import { WandSparkles } from "lucide-react";

function FindingList({ findings }: { findings: ContentReviewFindingDto[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无审核发现。</p>;
  }
  return (
    <div className="space-y-3">
      {findings.map((finding, index) => (
        <div key={`${finding.type}-${index}`} className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{finding.issue}</p>
              <p className="mt-1 text-xs text-muted-foreground">{finding.type}</p>
            </div>
            <Badge variant={finding.severity === "high" ? "destructive" : "secondary"}>
              {severityLabel[finding.severity]}风险
            </Badge>
            {finding.origin && (
              <Badge variant="outline">
                {finding.origin === "deterministic" ? "确定性规则" : "AI 建议"}
              </Badge>
            )}
            {finding.blocking && <Badge variant="destructive">必须修改</Badge>}
          </div>
          {finding.quote && (
            <p className="mt-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              “{finding.quote}”
            </p>
          )}
          <p className="mt-2 text-sm leading-6">{finding.suggestion}</p>
        </div>
      ))}
    </div>
  );
}

function ActiveWorkflowRecovery({
  runId,
  onRefresh,
}: {
  runId: string;
  onRefresh: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const runQuery = useWorkflowRun(runId, { refetchInterval: 3000 });
  const cancelWorkflow = useCancelWorkflow();
  const startedAt = runQuery.data?.started_at ?? runQuery.data?.created_at;
  const elapsedMs = startedAt ? runQuery.dataUpdatedAt - new Date(startedAt).getTime() : 0;
  const looksStalled =
    elapsedMs >= 5 * 60_000 &&
    ["queued", "running", "retrying"].includes(runQuery.data?.status ?? "");

  return (
    <div
      className={
        looksStalled
          ? "rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950"
          : "rounded-lg border bg-muted/30 p-3"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {looksStalled && <ClockAlert className="size-4" />}
            {looksStalled ? "本次审核耗时异常" : "本次审核正在运行"}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-80">
            {looksStalled
              ? "可能是任务拥堵或后台执行服务未运行。可先查看详情；确认无进展后取消，再重新发起审核。"
              : "可以查看实时步骤；如需停止本次审核，请使用取消操作。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/ai-runs/${runId}`}>
              <ExternalLink className="size-4" />
              查看运行详情
            </Link>
          </Button>
          <PermissionGate permission="content:review">
            <Button
              variant="destructive"
              size="sm"
              disabled={cancelWorkflow.isPending}
              onClick={() => setConfirmCancel(true)}
            >
              <Ban className="size-4" />
              取消本次审核
            </Button>
          </PermissionGate>
        </div>
      </div>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="取消本次 AI 审核？"
        description="取消后，本次运行的迟到结果不会再写入。页面刷新后可重新发起新的审核。"
        confirmLabel="确认取消"
        pending={cancelWorkflow.isPending}
        onConfirm={() =>
          cancelWorkflow.mutate(runId, {
            onSuccess: () => {
              setConfirmCancel(false);
              onRefresh();
            },
          })
        }
      />
    </div>
  );
}

export function ReviewFindingsPanel({ asset }: { asset: ContentAssetDto | null }) {
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const startReview = useStartContentReview();
  const rewrite = useRewriteContentAsset();
  const decide = useDecideApproval();
  const queryClient = useQueryClient();

  if (!asset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI 审核</CardTitle>
          <CardDescription>选择内容后发起审核并处理复核意见。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const findings = asset.pending_findings.length
    ? asset.pending_findings
    : (asset.latest_review?.findings ?? []);
  const feedback = asset.pending_feedback ?? asset.latest_review?.feedback ?? null;
  const hasHighRisk = findings.some((finding) => finding.severity === "high");
  const blockingFindings = findings.filter(
    (finding) => finding.severity === "high" && finding.blocking,
  );
  const advisoryHighFindingIds = findings
    .filter((finding) => finding.severity === "high" && !finding.blocking && finding.id)
    .map((finding) => finding.id!);
  const hasActiveWorkflow = !!asset.pending_workflow_run_id;
  const canRetryStalledReview = asset.status === "in_review" && !hasActiveWorkflow;
  const canRewrite =
    asset.status === "revision_requested" &&
    !hasActiveWorkflow &&
    (findings.length > 0 || Boolean(feedback));
  const canStart =
    !!asset.brief_id &&
    !hasActiveWorkflow &&
    (["submitted", "approved"].includes(asset.status) || canRetryStalledReview);
  const pendingCheckpointId = asset.pending_checkpoint_id;
  let reviewDescription = "基于 Brief、品牌规范与平台规则生成审核建议。";
  if (pendingCheckpointId) {
    reviewDescription = "AI 审核已进入人工复核，请在此处理审批意见。";
  } else if (hasActiveWorkflow) {
    reviewDescription = "AI 审核正在生成复核意见。";
  } else if (canRetryStalledReview) {
    reviewDescription = "上一次审核没有完成，可以重新发起 AI 审核。";
  }
  let startButtonLabel = "发起 AI 审核";
  if (hasActiveWorkflow) {
    startButtonLabel = "审核进行中";
  } else if (canRetryStalledReview) {
    startButtonLabel = "重新发起 AI 审核";
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: contentReviewKeys.all });
    void queryClient.invalidateQueries({ queryKey: contentReviewKeys.detail(asset.id) });
  };

  const decideCheckpoint = (
    decision: "approved" | "rejected" | "changes_requested",
    options?: { reason?: string; overrideHighRisk?: boolean },
  ) => {
    if (!pendingCheckpointId) return;
    decide.mutate(
      {
        id: pendingCheckpointId,
        decision,
        reason:
          options?.reason ??
          (decision === "approved"
            ? undefined
            : (feedback ?? "请根据 AI 审核意见修改后重新提交。")),
        ...(options?.overrideHighRisk
          ? {
              override: {
                enabled: true as const,
                category: "evidence_verified" as const,
                acknowledged_finding_ids: advisoryHighFindingIds,
              },
            }
          : {}),
      },
      {
        onSuccess: () => {
          setConfirmApprove(false);
          setOverrideReason("");
          refresh();
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 审核</CardTitle>
        <CardDescription>{reviewDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PermissionGate permission="content:review">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canStart || startReview.isPending}
              onClick={() => startReview.mutate({ id: asset.id })}
            >
              <Play className="size-4" />
              {startButtonLabel}
            </Button>
            {pendingCheckpointId && (
              <>
                <Button
                  variant="outline"
                  disabled={decide.isPending || blockingFindings.length > 0}
                  onClick={() =>
                    hasHighRisk ? setConfirmApprove(true) : decideCheckpoint("approved")
                  }
                >
                  <Check className="size-4" />
                  {blockingFindings.length > 0 ? "必须修改" : "批准"}
                </Button>
                <Button
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decideCheckpoint("changes_requested")}
                >
                  <RotateCcw className="size-4" />
                  要求修改
                </Button>
                <Button
                  variant="destructive"
                  disabled={decide.isPending}
                  onClick={() => decideCheckpoint("rejected")}
                >
                  <X className="size-4" />
                  驳回
                </Button>
              </>
            )}
            {canRewrite && (
              <Button
                variant="outline"
                disabled={rewrite.isPending}
                onClick={() => rewrite.mutate({ id: asset.id })}
              >
                <WandSparkles className="size-4" />
                AI 按建议改稿
              </Button>
            )}
          </div>
        </PermissionGate>

        {asset.pending_workflow_run_id && (
          <ActiveWorkflowRecovery runId={asset.pending_workflow_run_id} onRefresh={refresh} />
        )}

        {!asset.brief_id && (
          <p className="text-sm text-destructive">Brief 缺失：请先生成并批准 Brief。</p>
        )}
        {canRetryStalledReview && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {
              "上一次 AI 审核未产生可处理的审批项，内容仍停在审核中。请重新发起审核，系统会创建新的复核流程。"
            }
          </p>
        )}
        {feedback && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">给达人的修改说明</p>
            <p className="mt-1 text-sm leading-6">{feedback}</p>
          </div>
        )}
        {blockingFindings.length > 0 && pendingCheckpointId && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            内容命中品牌禁词或 Brief 的确定性规则，当前审核不能直接批准。请要求修改后重新提交审核。
          </p>
        )}
        {rewrite.data && (
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">AI 改稿摘要</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6">
              {rewrite.data.change_summary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm leading-6">{rewrite.data.creator_message}</p>
          </div>
        )}
        <FindingList findings={findings} />
      </CardContent>
      <Dialog
        open={confirmApprove}
        onOpenChange={(open) => {
          setConfirmApprove(open);
          if (!open) setOverrideReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认覆盖 AI 高风险建议？</DialogTitle>
            <DialogDescription>
              这不是对确定性禁词规则的放行。请说明已核验的依据，系统会记录确认的风险项和审批人。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            placeholder="覆盖说明（至少 10 个字）"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApprove(false)}>
              取消
            </Button>
            <Button
              disabled={overrideReason.trim().length < 10 || decide.isPending}
              onClick={() =>
                decideCheckpoint("approved", {
                  reason: overrideReason.trim(),
                  overrideHighRisk: true,
                })
              }
            >
              确认并批准
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
