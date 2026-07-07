"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { ApprovalPayloadSummary } from "@/features/approvals/components/approval-payload-summary";
import { useDecideApproval } from "@/features/approvals/queries";
import { cn } from "@/lib/utils";
import { CHECKPOINT_STATUS } from "@/shared/constants/status";
import { CHECKPOINT_TYPE_LABELS, type CheckpointDto } from "@/shared/schemas/checkpoint";

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

export function ApprovalCard({
  checkpoint,
  density = "default",
}: {
  checkpoint: CheckpointDto;
  density?: "default" | "compact";
}) {
  const decide = useDecideApproval();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const isPending = checkpoint.status === "pending";
  const isCompact = density === "compact";

  const content = (
    <div className={cn(isCompact ? "space-y-3" : "flex items-start justify-between gap-4")}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{CHECKPOINT_TYPE_LABELS[checkpoint.type] ?? checkpoint.type}</Badge>
          <span className="font-medium">{checkpoint.title}</span>
          <StatusTag source={CHECKPOINT_STATUS} value={checkpoint.status} />
          {checkpoint.priority !== "normal" && (
            <Badge variant="secondary">
              {PRIORITY_LABELS[checkpoint.priority] ?? checkpoint.priority}
            </Badge>
          )}
        </div>
        {checkpoint.summary && (
          <p className="text-sm text-muted-foreground">{checkpoint.summary}</p>
        )}
        <ApprovalPayloadSummary checkpoint={checkpoint} />
        <p className="text-xs text-muted-foreground">
          创建于 {format(new Date(checkpoint.created_at), "yyyy-MM-dd HH:mm")}
        </p>
        {!isPending && checkpoint.decided_at && (
          <p className="text-xs text-muted-foreground">
            {checkpoint.decided_by_name ?? "未知"} 于{" "}
            {format(new Date(checkpoint.decided_at), "yyyy-MM-dd HH:mm")} 处理
            {checkpoint.decision_reason && `：${checkpoint.decision_reason}`}
          </p>
        )}
      </div>
      {isPending && (
        <PermissionGate permission="approval:decide">
          <div className={cn("flex shrink-0 gap-2", isCompact && "pt-1")}>
            <Button
              size="sm"
              className={cn(isCompact && "h-8 flex-1")}
              onClick={() => setApproveOpen(true)}
              disabled={decide.isPending}
            >
              <Check className="size-4" />
              批准
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className={cn(isCompact && "h-8 flex-1")}
              onClick={() => setRejectOpen(true)}
              disabled={decide.isPending}
            >
              <X className="size-4" />
              驳回
            </Button>
          </div>
        </PermissionGate>
      )}
    </div>
  );

  return (
    <>
      {isCompact ? (
        <article className="rounded-md border bg-background p-3 text-sm">{content}</article>
      ) : (
        <Card className="py-4">
          <CardContent className="px-4">{content}</CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="确认批准？"
        description={`批准后「${checkpoint.title}」对应的动作将继续执行。`}
        confirmLabel="批准"
        destructive={false}
        pending={decide.isPending}
        onConfirm={() =>
          decide.mutate(
            { id: checkpoint.id, decision: "approved" },
            { onSuccess: () => setApproveOpen(false) },
          )
        }
      />

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>驳回审批</DialogTitle>
            <DialogDescription>请填写驳回原因，将记录到审批历史。</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="驳回原因（必填）"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || decide.isPending}
              onClick={() =>
                decide.mutate(
                  { id: checkpoint.id, decision: "rejected", reason: rejectReason.trim() },
                  { onSuccess: () => setRejectOpen(false) },
                )
              }
            >
              {decide.isPending ? "处理中…" : "确认驳回"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
