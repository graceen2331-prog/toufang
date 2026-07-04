"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { CheckpointDto } from "@/shared/schemas/checkpoint";

export interface ApprovalFilters {
  status?: string;
  type?: string;
  cursor?: string | null;
}

export const approvalKeys = {
  all: ["approvals"] as const,
  list: (params: ApprovalFilters) => ["approvals", "list", params] as const,
  pendingCount: ["approvals", "pending-count"] as const,
};

export function useApprovals(params: ApprovalFilters) {
  return useQuery({
    queryKey: approvalKeys.list(params),
    queryFn: () =>
      apiFetchList<CheckpointDto>("/approvals", {
        params: {
          status: params.status,
          type: params.type,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

/** 待审批数量：Topbar 红点用，30 秒轮询 */
export function usePendingApprovalCount() {
  return useQuery({
    queryKey: approvalKeys.pendingCount,
    queryFn: () => apiFetch<{ pending: number }>("/approvals", { params: { count: "pending" } }),
    refetchInterval: 30_000,
  });
}

const DECISION_TOASTS: Record<string, string> = {
  approved: "已批准",
  rejected: "已驳回",
  changes_requested: "已退回修改",
};

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "approved" | "rejected" | "changes_requested";
      reason?: string;
    }) =>
      apiFetch<CheckpointDto>(`/approvals/${id}/decide`, {
        method: "POST",
        body: { decision, reason },
      }),
    onSuccess: (_data, vars) => {
      toast.success(DECISION_TOASTS[vars.decision] ?? "已处理");
      void queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
