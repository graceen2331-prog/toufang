"use client";

import { Suspense, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { useApprovals, useDecideApproval } from "@/features/approvals/queries";
import { useCursorPagination, useUrlFilters } from "@/lib/list-state";
import { CHECKPOINT_STATUS } from "@/shared/constants/status";
import { CHECKPOINT_TYPE_LABELS } from "@/shared/schemas/checkpoint";
import type { CheckpointDto } from "@/shared/schemas/checkpoint";

const FILTER_DEFAULTS = { status: "pending", type: "" };

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

export default function ApprovalsPage() {
  return (
    <Suspense>
      <ApprovalsPageInner />
    </Suspense>
  );
}

function ApprovalsPageInner() {
  const { filters, setFilter, reset, isFiltered } = useUrlFilters(FILTER_DEFAULTS);
  const pagination = useCursorPagination();

  const { data, isLoading, isError, error, refetch } = useApprovals({
    status: filters.status === "all" ? undefined : filters.status,
    type: filters.type || undefined,
    cursor: pagination.cursor,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="审批中心"
        description="AI 工作流与人工操作触发的审批门：外发、合同、付款、报告等关键动作都需要在此确认。"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status}
          onValueChange={(v) => {
            setFilter("status", v);
            pagination.resetPages();
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">状态（全部）</SelectItem>
            {Object.entries(CHECKPOINT_STATUS).map(([value, meta]) => (
              <SelectItem key={value} value={value}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterSelect
          placeholder="类型"
          value={filters.type}
          onChange={(v) => {
            setFilter("type", v);
            pagination.resetPages();
          }}
          options={Object.entries(CHECKPOINT_TYPE_LABELS).map(([value, label]) => ({
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
        filtered={filters.type !== "" || filters.status !== "pending"}
        emptyTitle="暂无待审批事项"
        emptyHint="AI 工作流触发审批后会出现在这里"
      >
        <div className="space-y-3">
          {(data?.items ?? []).map((checkpoint) => (
            <ApprovalCard key={checkpoint.id} checkpoint={checkpoint} />
          ))}
        </div>
      </AsyncBoundary>

      {(pagination.hasPrev || data?.pagination.has_more) && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">第 {pagination.page} 页</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrev}
            onClick={pagination.prev}
          >
            <ChevronLeft className="size-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.pagination.has_more}
            onClick={() => data?.pagination.next_cursor && pagination.next(data.pagination.next_cursor)}
          >
            下一页
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ checkpoint }: { checkpoint: CheckpointDto }) {
  const decide = useDecideApproval();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isPending = checkpoint.status === "pending";
  const hasPayload = Object.keys(checkpoint.payload).length > 0;

  return (
    <Card className="py-4">
      <CardContent className="flex items-start justify-between gap-4 px-4">
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
          </div>
          {checkpoint.summary && (
            <p className="text-sm text-muted-foreground">{checkpoint.summary}</p>
          )}
          {hasPayload && (
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
              {JSON.stringify(checkpoint.payload, null, 2)}
            </pre>
          )}
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
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => setApproveOpen(true)} disabled={decide.isPending}>
                <Check className="size-4" />
                批准
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setRejectOpen(true)}
                disabled={decide.isPending}
              >
                <X className="size-4" />
                驳回
              </Button>
            </div>
          </PermissionGate>
        )}
      </CardContent>

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
    </Card>
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
