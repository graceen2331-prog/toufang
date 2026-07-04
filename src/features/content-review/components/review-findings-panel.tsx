"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useDecideApproval } from "@/features/approvals/queries";
import {
  contentReviewKeys,
  useStartContentReview,
} from "@/features/content-review/queries";
import type { ContentAssetDto, ContentReviewFindingDto } from "@/shared/schemas/content-analytics";

const severityLabel: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

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

export function ReviewFindingsPanel({ asset }: { asset: ContentAssetDto | null }) {
  const [confirmApprove, setConfirmApprove] = useState(false);
  const startReview = useStartContentReview();
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
    : asset.latest_review?.findings ?? [];
  const feedback = asset.pending_feedback ?? asset.latest_review?.feedback ?? null;
  const hasHighRisk = findings.some((finding) => finding.severity === "high");
  const hasActiveWorkflow = !!asset.pending_workflow_run_id;
  const canRetryStalledReview = asset.status === "in_review" && !hasActiveWorkflow;
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

  const decideCheckpoint = (decision: "approved" | "rejected" | "changes_requested") => {
    if (!pendingCheckpointId) return;
    decide.mutate(
      {
        id: pendingCheckpointId,
        decision,
        reason:
          decision === "approved"
            ? undefined
            : feedback ?? "请根据 AI 审核意见修改后重新提交。",
      },
      { onSuccess: refresh },
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
                  disabled={decide.isPending}
                  onClick={() => (hasHighRisk ? setConfirmApprove(true) : decideCheckpoint("approved"))}
                >
                  <Check className="size-4" />
                  批准
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
          </div>
        </PermissionGate>

        {!asset.brief_id && (
          <p className="text-sm text-destructive">Brief 缺失：请先生成并批准 Brief。</p>
        )}
        {canRetryStalledReview && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            上一次 AI 审核未产生可处理的审批项，内容仍停在审核中。请重新发起审核，系统会创建新的复核流程。
          </p>
        )}
        {feedback && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">给达人的修改说明</p>
            <p className="mt-1 text-sm leading-6">{feedback}</p>
          </div>
        )}
        <FindingList findings={findings} />
      </CardContent>
      <ConfirmDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="确认批准高风险内容？"
        description="AI 审核发现高风险问题。批准后内容会进入已过审状态，请确认已人工复核风险。"
        confirmLabel="批准"
        destructive={false}
        pending={decide.isPending}
        onConfirm={() => {
          decideCheckpoint("approved");
          setConfirmApprove(false);
        }}
      />
    </Card>
  );
}
