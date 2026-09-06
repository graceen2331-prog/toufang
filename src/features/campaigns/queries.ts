"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { StatusEventDto } from "@/shared/schemas/common";
import type {
  BudgetItemDto,
  BudgetItemInput,
  CampaignCreateInput,
  CampaignCreatorDto,
  CampaignDetailDto,
  CampaignListItemDto,
  CampaignTaskDto,
  CampaignTaskInput,
  CampaignUpdateInput,
} from "@/shared/schemas/campaign";

export interface CampaignFilters {
  q?: string;
  status?: string;
  brand_id?: string;
  cursor?: string | null;
}

/** 任务更新载荷：可部分更新字段，也可切换状态 */
export type CampaignTaskUpdatePayload = Partial<CampaignTaskInput> & {
  status?: "todo" | "in_progress" | "done" | "cancelled";
};

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: (params: CampaignFilters) => ["campaigns", "list", params] as const,
  detail: (id: string) => ["campaigns", "detail", id] as const,
  events: (id: string) => ["campaigns", "events", id] as const,
  creators: (id: string) => ["campaigns", "creators", id] as const,
  tasks: (id: string) => ["campaigns", "tasks", id] as const,
  budget: (id: string) => ["campaigns", "budget", id] as const,
};

// ---------------------------------------------------------------
// 查询
// ---------------------------------------------------------------

export function useCampaigns(params: CampaignFilters) {
  return useQuery({
    queryKey: campaignKeys.list(params),
    queryFn: () =>
      apiFetchList<CampaignListItemDto>("/campaigns", {
        params: {
          q: params.q,
          status: params.status,
          brand_id: params.brand_id,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => apiFetch<CampaignDetailDto>(`/campaigns/${id}`),
  });
}

export function useCampaignEvents(id: string) {
  return useQuery({
    queryKey: campaignKeys.events(id),
    queryFn: () => apiFetch<StatusEventDto[]>(`/campaigns/${id}/events`),
  });
}

export function useCampaignCreators(id: string) {
  return useQuery({
    queryKey: campaignKeys.creators(id),
    queryFn: () => apiFetch<CampaignCreatorDto[]>(`/campaigns/${id}/creators`),
  });
}

export function useCampaignTasks(id: string) {
  return useQuery({
    queryKey: campaignKeys.tasks(id),
    queryFn: () => apiFetch<CampaignTaskDto[]>(`/campaigns/${id}/tasks`),
  });
}

export function useCampaignBudget(id: string) {
  return useQuery({
    queryKey: campaignKeys.budget(id),
    queryFn: () => apiFetch<BudgetItemDto[]>(`/campaigns/${id}/budget-items`),
  });
}

// ---------------------------------------------------------------
// 变更
// ---------------------------------------------------------------

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
  };
}

export function useCreateCampaign() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CampaignCreateInput) =>
      apiFetch<CampaignDetailDto>("/campaigns", { method: "POST", body: input }),
    onSuccess: (campaign) => {
      toast.success(`Campaign「${campaign.name}」已创建`);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateCampaign() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CampaignUpdateInput }) =>
      apiFetch<CampaignDetailDto>(`/campaigns/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success("Campaign 已更新");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTransitionCampaignStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: string; reason?: string }) =>
      apiFetch<CampaignDetailDto>(`/campaigns/${id}/status`, {
        method: "POST",
        body: { to, reason },
      }),
    onSuccess: () => {
      toast.success("Campaign 状态已更新");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useAddCampaignCreators() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      campaignId,
      creator_ids,
      role,
    }: {
      campaignId: string;
      creator_ids: string[];
      role?: string | null;
    }) =>
      apiFetch<{ added: number }>(`/campaigns/${campaignId}/creators`, {
        method: "POST",
        body: { creator_ids, role },
      }),
    onSuccess: (result) => {
      toast.success(`已添加 ${result.added} 位达人`);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTransitionCampaignCreator() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      campaignId,
      ccId,
      to,
      field,
      reason,
    }: {
      campaignId: string;
      ccId: string;
      to: string;
      field?: "status" | "contract_status" | "payment_status" | "content_status";
      reason?: string;
    }) =>
      apiFetch<{ updated: boolean }>(`/campaigns/${campaignId}/creators/${ccId}`, {
        method: "POST",
        body: { to, field: field ?? "status", reason },
      }),
    onSuccess: () => {
      toast.success("达人状态已更新");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useRemoveCampaignCreator() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ campaignId, ccId }: { campaignId: string; ccId: string }) =>
      apiFetch<{ deleted: boolean }>(`/campaigns/${campaignId}/creators/${ccId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("达人已移出 Campaign");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useCreateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input: CampaignTaskInput }) =>
      apiFetch<{ created: boolean }>(`/campaigns/${campaignId}/tasks`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      toast.success("任务已创建");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      campaignId,
      taskId,
      input,
    }: {
      campaignId: string;
      taskId: string;
      input: CampaignTaskUpdatePayload;
    }) =>
      apiFetch<{ updated: boolean }>(`/campaigns/${campaignId}/tasks/${taskId}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      toast.success("任务已更新");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ campaignId, taskId }: { campaignId: string; taskId: string }) =>
      apiFetch<{ deleted: boolean }>(`/campaigns/${campaignId}/tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("任务已删除");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useCreateBudgetItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input: BudgetItemInput }) =>
      apiFetch<{ created: boolean }>(`/campaigns/${campaignId}/budget-items`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      toast.success("预算项已创建");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateBudgetItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      campaignId,
      itemId,
      input,
    }: {
      campaignId: string;
      itemId: string;
      input: Partial<BudgetItemInput>;
    }) =>
      apiFetch<{ updated: boolean }>(`/campaigns/${campaignId}/budget-items/${itemId}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      toast.success("预算项已更新");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteBudgetItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ campaignId, itemId }: { campaignId: string; itemId: string }) =>
      apiFetch<{ deleted: boolean }>(`/campaigns/${campaignId}/budget-items/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("预算项已删除");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}
