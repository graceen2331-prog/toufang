"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type {
  KnowledgeAnswerDto,
  KnowledgeDocumentCreateInput,
  KnowledgeDocumentDto,
  KnowledgeQueryInput,
  RagQueryDto,
} from "@/shared/schemas/knowledge";

export interface KnowledgeDocumentFilters {
  status?: string;
  type?: string;
  q?: string;
  cursor?: string | null;
}

export const knowledgeKeys = {
  all: ["knowledge"] as const,
  documents: (params: KnowledgeDocumentFilters) => ["knowledge", "documents", params] as const,
  history: ["knowledge", "history"] as const,
};

export function useKnowledgeDocuments(params: KnowledgeDocumentFilters) {
  return useQuery({
    queryKey: knowledgeKeys.documents(params),
    queryFn: () =>
      apiFetchList<KnowledgeDocumentDto>("/knowledge-documents", {
        params: {
          status: params.status,
          type: params.type,
          q: params.q,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => ["uploaded", "parsing", "chunking", "embedding"].includes(item.status))
        ? 5000
        : false,
  });
}

export function useCreateKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: KnowledgeDocumentCreateInput) =>
      apiFetch<KnowledgeDocumentDto>("/knowledge-documents", { method: "POST", body: input }),
    onSuccess: () => {
      toast.success("知识文档已入队摄取");
      void queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/knowledge-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("知识文档已归档");
      void queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useReindexKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<KnowledgeDocumentDto>(`/knowledge-documents/${id}/reindex`, { method: "POST" }),
    onSuccess: () => {
      toast.success("重新索引已入队");
      void queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useAskKnowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: KnowledgeQueryInput) =>
      apiFetch<KnowledgeAnswerDto>("/knowledge/query", { method: "POST", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: knowledgeKeys.history });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useRagHistory() {
  return useQuery({
    queryKey: knowledgeKeys.history,
    queryFn: () => apiFetch<RagQueryDto[]>("/knowledge/query"),
  });
}
