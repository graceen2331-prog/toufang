"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, ArrowRightLeft, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { StatusTag } from "@/components/shared/status-tag";
import { ApprovalPayloadSummary } from "@/features/approvals/components/approval-payload-summary";
import { useDecideApproval, useEscalateApproval, useTransferApproval } from "@/features/approvals/queries";
import { cn } from "@/lib/utils";
import { CHECKPOINT_STATUS } from "@/shared/constants/status";
import { CHECKPOINT_TYPE_LABELS, type CheckpointDto } from "@/shared/schemas/checkpoint";

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentRiskSummary(checkpoint: CheckpointDto): {
  highRisk: boolean;
  blocking: boolean;
  advisoryFindingIds: string[];
} {
  if (checkpoint.type !== "content") {
    return { highRisk: false, blocking: false, advisoryFindingIds: [] };
  }
  const review = isRecord(checkpoint.payload.review) ? checkpoint.payload.review : null;
  if (!review) return { highRisk: false, blocking: false, advisoryFindingIds: [] };
  const highFindings = Array.isArray(review.findings)
    ? review.findings.filter((finding) => isRecord(finding) && finding.severity === "high")
    : [];
  return {
    highRisk: highFindings.length > 0,
    blocking: highFindings.some((finding) => finding.blocking === true),
    advisoryFindingIds: highFindings
      .filter((finding) => finding.blocking !== true && typeof finding.id === "string")
      .map((finding) => finding.id as string),
  };
}

export function ApprovalCard({
  checkpoint,
  density = "default",
}: {
  checkpoint: CheckpointDto;
  density?: "default" | "compact";
}) {
  const decide = useDecideApproval();
  const transfer = useTransferApproval();
  const escalate = useEscalateApproval();
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveReason, setApproveReason] = useState("");
  const [accountChecked, setAccountChecked] = useState(false);
  const [invoiceChecked, setInvoiceChecked] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUserId, setTransferUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const isPending = checkpoint.status === "pending";
  const isCompact = density === "compact";
  const contentRisk = contentRiskSummary(checkpoint);
  const highRiskContent = contentRisk.highRisk;
  const isPayment = checkpoint.type === "payment";
  const paymentSnapshotHash =
    isPayment && typeof checkpoint.payload.snapshot_hash === "string"
      ? checkpoint.payload.snapshot_hash
      : null;

  const content = (
    <div className={cn(isCompact ? "space-y-3" : "flex items-start justify-between gap-4")}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {CHECKPOINT_TYPE_LABELS[checkpoint.type] ?? checkpoint.type}
          </Badge>
          <span className="font-medium">{checkpoint.title}</span>
          <StatusTag source={CHECKPOINT_STATUS} value={checkpoint.status} />
          {checkpoint.priority !== "normal" && (
            <Badge variant="secondary">
              {PRIORITY_LABELS[checkpoint.priority] ?? checkpoint.priority}
            </Badge>
          )}
          {highRiskContent && <Badge variant="destructive">高风险内容</Badge>}
        </div>
        {checkpoint.summary && (
          <p className="text-sm text-muted-foreground">{checkpoint.summary}</p>
        )}
        <ApprovalPayloadSummary checkpoint={checkpoint} />
        <p className="text-xs text-muted-foreground">
          创建于 {format(new Date(checkpoint.created_at), "yyyy-MM-dd HH:mm")}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>发起人：{checkpoint.created_by_name ?? "未知"}</span>
          <span>审批人：{checkpoint.assignee_name ?? (checkpoint.assignee_role ? `角色池（${checkpoint.assignee_role}）` : "公共审批池")}</span>
          {checkpoint.due_at && (
            <span className={checkpoint.is_overdue ? "font-medium text-destructive" : ""}>
              {checkpoint.is_overdue ? `已逾期 ${Math.max(1, Math.floor(checkpoint.overdue_seconds / 3600))} 小时` : `截止 ${format(new Date(checkpoint.due_at), "MM-dd HH:mm")}`}
            </span>
          )}
          {checkpoint.escalation_level > 0 && <span>已升级 {checkpoint.escalation_level} 次</span>}
        </div>
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
              disabled={decide.isPending || contentRisk.blocking}
            >
              <Check className="size-4" />
              {contentRisk.blocking ? "必须修改" : "批准"}
            </Button>
            <PermissionGate permission="approval:assign">
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)} disabled={decide.isPending || transfer.isPending}>
                <ArrowRightLeft className="size-4" />转交
              </Button>
            </PermissionGate>
            <PermissionGate permission="approval:escalate">
              <Button size="sm" variant="outline" onClick={() => setEscalateOpen(true)} disabled={decide.isPending || escalate.isPending}>
                <AlertTriangle className="size-4" />升级
              </Button>
            </PermissionGate>
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

      {isPayment ? (
        <Dialog
          open={approveOpen}
          onOpenChange={(open) => {
            setApproveOpen(open);
            if (!open) {
              setApproveReason("");
              setAccountChecked(false);
              setInvoiceChecked(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>确认批准付款申请？</DialogTitle>
              <DialogDescription>
                系统只保存内部授权，不会执行银行转账。请人工核对收款账户和票据依据。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-md border p-3 text-sm">
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={accountChecked}
                  onCheckedChange={(checked) => setAccountChecked(checked === true)}
                />
                <span>我已人工核对收款人、开户机构和账号末四位</span>
              </label>
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={invoiceChecked}
                  onCheckedChange={(checked) => setInvoiceChecked(checked === true)}
                />
                <span>我已人工核对发票信息或免票依据</span>
              </label>
              {paymentSnapshotHash && (
                <p className="text-xs text-muted-foreground">
                  审批快照 {paymentSnapshotHash.slice(0, 12)}
                </p>
              )}
            </div>
            <Textarea
              placeholder="审批说明（至少 5 个字）"
              rows={3}
              value={approveReason}
              onChange={(event) => setApproveReason(event.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveOpen(false)}>
                取消
              </Button>
              <Button
                disabled={
                  !paymentSnapshotHash ||
                  !accountChecked ||
                  !invoiceChecked ||
                  approveReason.trim().length < 5 ||
                  decide.isPending
                }
                onClick={() =>
                  decide.mutate(
                    {
                      id: checkpoint.id,
                      decision: "approved",
                      reason: approveReason.trim(),
                      payment_confirmation: {
                        account_manually_checked: true,
                        invoice_manually_checked: true,
                        snapshot_hash: paymentSnapshotHash!,
                      },
                    },
                    { onSuccess: () => setApproveOpen(false) },
                  )
                }
              >
                确认授权
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : highRiskContent ? (
        <Dialog
          open={approveOpen}
          onOpenChange={(open) => {
            setApproveOpen(open);
            if (!open) setApproveReason("");
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>确认覆盖 AI 高风险建议？</DialogTitle>
              <DialogDescription>
                请填写已核验的依据。品牌禁词或 Brief 确定性规则不能通过此操作放行。
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="覆盖说明（至少 10 个字）"
              rows={4}
              value={approveReason}
              onChange={(event) => setApproveReason(event.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveOpen(false)}>
                取消
              </Button>
              <Button
                disabled={approveReason.trim().length < 10 || decide.isPending}
                onClick={() =>
                  decide.mutate(
                    {
                      id: checkpoint.id,
                      decision: "approved",
                      reason: approveReason.trim(),
                      override: {
                        enabled: true,
                        category: "evidence_verified",
                        acknowledged_finding_ids: contentRisk.advisoryFindingIds,
                      },
                    },
                    { onSuccess: () => setApproveOpen(false) },
                  )
                }
              >
                确认并批准
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={approveOpen} onOpenChange={(open) => { setApproveOpen(open); if (!open) setApproveReason(""); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>确认批准？</DialogTitle><DialogDescription>批准后「{checkpoint.title}」对应的动作将继续执行，请填写处理意见。</DialogDescription></DialogHeader>
            <Textarea placeholder="批准意见（至少 5 个字）" rows={3} value={approveReason} onChange={(event) => setApproveReason(event.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveOpen(false)}>取消</Button>
              <Button disabled={approveReason.trim().length < 5 || decide.isPending} onClick={() => decide.mutate({ id: checkpoint.id, decision: "approved", reason: approveReason.trim(), expected_version: checkpoint.version }, { onSuccess: () => setApproveOpen(false) })}>确认批准</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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

      <Dialog open={transferOpen} onOpenChange={(open) => { setTransferOpen(open); if (!open) { setTransferUserId(""); setTransferReason(""); } }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>转交审批</DialogTitle><DialogDescription>请输入同租户且具备审批权限的用户 ID，并填写原因。</DialogDescription></DialogHeader>
          <Textarea placeholder="目标用户 ID" rows={1} value={transferUserId} onChange={(e) => setTransferUserId(e.target.value)} />
          <Textarea placeholder="转交原因（必填）" rows={3} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setTransferOpen(false)}>取消</Button><Button disabled={!transferUserId.trim() || !transferReason.trim() || transfer.isPending} onClick={() => transfer.mutate({ id: checkpoint.id, to_user_id: transferUserId.trim(), reason: transferReason.trim(), expected_version: checkpoint.version }, { onSuccess: () => setTransferOpen(false) })}>确认转交</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={escalateOpen} onOpenChange={(open) => { setEscalateOpen(open); if (!open) setEscalateReason(""); }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>升级审批</DialogTitle><DialogDescription>升级会提高优先级并留下审计记录，不会自动批准。</DialogDescription></DialogHeader>
          <Textarea placeholder="升级原因（必填）" rows={3} value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} />
          <DialogFooter><Button variant="outline" onClick={() => setEscalateOpen(false)}>取消</Button><Button disabled={!escalateReason.trim() || escalate.isPending} onClick={() => escalate.mutate({ id: checkpoint.id, reason: escalateReason.trim(), expected_version: checkpoint.version }, { onSuccess: () => setEscalateOpen(false) })}>确认升级</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
