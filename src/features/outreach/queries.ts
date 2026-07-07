"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type {
  NegotiationRecordDto,
  OutreachCandidateDto,
  OutreachMessageDto,
  OutreachThreadDetailDto,
  OutreachThreadListItemDto,
} from "@/shared/schemas/outreach";

export interface OutreachFilters {
  status?: string;
  campaign_id?: string;
  cursor?: string | null;
}

export const outreachKeys = {
  all: ["outreach"] as const,
  list: (params: OutreachFilters) => ["outreach", "list", params] as const,
  candidates: (campaignId: string) => ["outreach", "candidates", campaignId] as const,
  detail: (id: string) => ["outreach", "detail", id] as const,
};

export function useOutreachThreads(params: OutreachFilters) {
  return useQuery({
    queryKey: outreachKeys.list(params),
    queryFn: () =>
      apiFetchList<OutreachThreadListItemDto>("/outreach", {
        params: {
          status: params.status,
          campaign_id: params.campaign_id,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useOutreachThread(id: string) {
  return useQuery({
    queryKey: outreachKeys.detail(id),
    queryFn: () => apiFetch<OutreachThreadDetailDto>(`/outreach/${id}`),
  });
}

export function useOutreachCandidates(campaignId: string) {
  return useQuery({
    queryKey: outreachKeys.candidates(campaignId),
    queryFn: () =>
      apiFetch<OutreachCandidateDto[]>("/outreach/candidates", {
        params: { campaign_id: campaignId },
      }),
    enabled: campaignId.length > 0,
  });
}

function useInvalidateOutreach() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: outreachKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: outreachKeys.detail(id) });
  };
}

export function useCreateOutreachThread() {
  const invalidate = useInvalidateOutreach();
  return useMutation({
    mutationFn: (input: { campaign_creator_id: string; channel?: string; subject?: string | null }) =>
      apiFetch<OutreachThreadDetailDto>("/outreach", { method: "POST", body: input }),
    onSuccess: (thread) => {
      toast.success("外联会话已创建");
      invalidate(thread.id);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDraftOutreachMessage(threadId: string) {
  const invalidate = useInvalidateOutreach();
  return useMutation({
    mutationFn: (input: { instruction?: string | null }) =>
      apiFetch<OutreachMessageDto>(`/outreach/${threadId}/draft`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      toast.success("AI 外联草稿已生成");
      invalidate(threadId);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useAddOutreachMessage(threadId: string) {
  const invalidate = useInvalidateOutreach();
  return useMutation({
    mutationFn: (input: { direction: "outbound" | "inbound"; subject?: string | null; body: string }) =>
      apiFetch<OutreachMessageDto>(`/outreach/${threadId}/messages`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      toast.success("消息已记录");
      invalidate(threadId);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTransitionOutreachMessage(threadId: string) {
  const invalidate = useInvalidateOutreach();
  return useMutation({
    mutationFn: ({ messageId, to, reason }: { messageId: string; to: string; reason?: string }) =>
      apiFetch<{ updated: boolean }>(`/outreach/messages/${messageId}/status`, {
        method: "POST",
        body: { to, reason },
      }),
    onSuccess: () => {
      toast.success("消息状态已更新");
      invalidate(threadId);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useAnalyzeNegotiation(threadId: string) {
  const invalidate = useInvalidateOutreach();
  return useMutation({
    mutationFn: (input: {
      reply_message_id?: string | null;
      reply_text?: string | null;
      quoted_price_cents?: number | null;
    }) =>
      apiFetch<NegotiationRecordDto>(`/outreach/${threadId}/negotiations/analyze`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      toast.success("谈判分析已生成");
      invalidate(threadId);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useConfirmNegotiationTerms(threadId: string) {
  const invalidate = useInvalidateOutreach();
  return useMutation({
    mutationFn: ({
      negotiationId,
      input,
    }: {
      negotiationId: string;
      input: {
        agreed_price_cents: number;
        deliverables: string[];
        usage_rights?: string | null;
        payment_terms?: string | null;
        notes?: string | null;
      };
    }) =>
      apiFetch<NegotiationRecordDto>(`/negotiations/${negotiationId}/terms`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      toast.success("合作条款已确认");
      invalidate(threadId);
    },
    onError: (err) => toast.error(err.message),
  });
}
