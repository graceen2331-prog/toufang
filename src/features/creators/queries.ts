"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { StatusEventDto } from "@/shared/schemas/common";
import type {
  ContactInfo,
  CreatorCreateInput,
  CreatorDetailDto,
  CreatorListItemDto,
  CreatorNoteDto,
  CreatorUpdateInput,
  PlatformAccountDto,
  PlatformAccountInput,
} from "@/shared/schemas/creator";

export interface CreatorFilters {
  q?: string;
  platform?: string;
  relationship_status?: string;
  risk_level?: string;
  cursor?: string | null;
}

export const creatorKeys = {
  all: ["creators"] as const,
  list: (params: CreatorFilters) => ["creators", "list", params] as const,
  detail: (id: string) => ["creators", "detail", id] as const,
  contact: (id: string) => ["creators", "contact", id] as const,
  notes: (id: string) => ["creators", "notes", id] as const,
  events: (id: string) => ["creators", "events", id] as const,
};

export function useCreators(params: CreatorFilters) {
  return useQuery({
    queryKey: creatorKeys.list(params),
    queryFn: () =>
      apiFetchList<CreatorListItemDto>("/creators", {
        params: {
          q: params.q,
          platform: params.platform,
          relationship_status: params.relationship_status,
          risk_level: params.risk_level,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useCreator(id: string) {
  return useQuery({
    queryKey: creatorKeys.detail(id),
    queryFn: () => apiFetch<CreatorDetailDto>(`/creators/${id}`),
  });
}

export function useCreatorContact(id: string, enabled: boolean) {
  return useQuery({
    queryKey: creatorKeys.contact(id),
    queryFn: () => apiFetch<ContactInfo>(`/creators/${id}/contact`),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export function useCreatorNotes(id: string) {
  return useQuery({
    queryKey: creatorKeys.notes(id),
    queryFn: () => apiFetch<CreatorNoteDto[]>(`/creators/${id}/notes`),
  });
}

export function useCreatorEvents(id: string) {
  return useQuery({
    queryKey: creatorKeys.events(id),
    queryFn: () => apiFetch<StatusEventDto[]>(`/creators/${id}/events`),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: creatorKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: creatorKeys.detail(id) });
  };
}

export function useCreateCreator() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreatorCreateInput) =>
      apiFetch<CreatorDetailDto>("/creators", { method: "POST", body: input }),
    onSuccess: (creator) => {
      toast.success(`达人「${creator.display_name}」已创建`);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateCreator() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreatorUpdateInput }) =>
      apiFetch<CreatorDetailDto>(`/creators/${id}`, { method: "PATCH", body: input }),
    onSuccess: (creator) => {
      toast.success("达人资料已更新");
      invalidate(creator.id);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTransitionCreatorStatus() {
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: string; reason?: string }) =>
      apiFetch<CreatorDetailDto>(`/creators/${id}/status`, {
        method: "POST",
        body: { to, reason },
      }),
    onSuccess: (creator) => {
      toast.success("关系状态已更新");
      invalidate(creator.id);
      void queryClient.invalidateQueries({ queryKey: creatorKeys.events(creator.id) });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteCreator() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/creators/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("达人已删除");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useAddPlatformAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ creatorId, input }: { creatorId: string; input: PlatformAccountInput }) =>
      apiFetch<PlatformAccountDto>(`/creators/${creatorId}/platform-accounts`, {
        method: "POST",
        body: input,
      }),
    onSuccess: (_data, vars) => {
      toast.success("平台账号已添加");
      invalidate(vars.creatorId);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useRemovePlatformAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ creatorId, accountId }: { creatorId: string; accountId: string }) =>
      apiFetch<{ deleted: boolean }>(`/creators/${creatorId}/platform-accounts/${accountId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, vars) => {
      toast.success("平台账号已移除");
      invalidate(vars.creatorId);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useAddCreatorNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorId, content }: { creatorId: string; content: string }) =>
      apiFetch<{ created: boolean }>(`/creators/${creatorId}/notes`, {
        method: "POST",
        body: { content },
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: creatorKeys.notes(vars.creatorId) });
    },
    onError: (err) => toast.error(err.message),
  });
}
