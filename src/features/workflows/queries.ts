"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList, ApiClientError } from "@/lib/api";
import type {
  AiUsageSummaryDto,
  StartWorkflowResponseDto,
  StrategyVersionDto,
  WorkflowRunDetailDto,
  WorkflowRunListItemDto,
} from "@/shared/schemas/workflow";

export interface WorkflowRunFilters {
  status?: string;
  workflow_key?: string;
  cursor?: string | null;
}

export const workflowKeys = {
  all: ["workflows"] as const,
  list: (params: WorkflowRunFilters) => ["workflows", "list", params] as const,
  detail: (id: string) => ["workflows", "detail", id] as const,
  usage: ["workflows", "usage"] as const,
  strategyVersions: (campaignId: string) =>
    ["workflows", "strategy-versions", campaignId] as const,
};

// ---------------------------------------------------------------
// 查询
// ---------------------------------------------------------------

export function useWorkflowRuns(params: WorkflowRunFilters) {
  return useQuery({
    queryKey: workflowKeys.list(params),
    queryFn: () =>
      apiFetchList<WorkflowRunListItemDto>("/workflow-runs", {
        params: {
          status: params.status,
          workflow_key: params.workflow_key,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useWorkflowRun(id: string, opts?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: () => apiFetch<WorkflowRunDetailDto>(`/workflow-runs/${id}`),
    refetchInterval: opts?.refetchInterval,
  });
}

export function useAiUsage() {
  return useQuery({
    queryKey: workflowKeys.usage,
    queryFn: () => apiFetch<AiUsageSummaryDto>("/ai/usage"),
  });
}

export function useStrategyVersions(campaignId: string) {
  return useQuery({
    queryKey: workflowKeys.strategyVersions(campaignId),
    queryFn: () => apiFetch<StrategyVersionDto[]>(`/campaigns/${campaignId}/strategy-versions`),
  });
}

// ---------------------------------------------------------------
// 变更
// ---------------------------------------------------------------

export function useStartCampaignWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, key }: { campaignId: string; key: string }) =>
      apiFetch<StartWorkflowResponseDto>(`/campaigns/${campaignId}/workflows/${key}`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("工作流已启动");
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "CONFLICT") {
        toast.error("已有进行中的工作流");
      } else {
        toast.error(err.message);
      }
    },
  });
}

export function useRetryWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ retried: boolean }>(`/workflow-runs/${id}/retry`, { method: "POST" }),
    onSuccess: (_data, id) => {
      toast.success("已发起重试");
      void queryClient.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useCancelWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ cancelled: boolean }>(`/workflow-runs/${id}/cancel`, { method: "POST" }),
    onSuccess: (_data, id) => {
      toast.success("工作流已取消");
      void queryClient.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
