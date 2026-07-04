"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { StartWorkflowResponseDto } from "@/shared/schemas/workflow";
import type {
  ContentAssetCreateInput,
  ContentAssetDto,
  ContentReviewDto,
} from "@/shared/schemas/content-analytics";

export interface ContentAssetFilters {
  status?: string;
  campaign_id?: string;
  cursor?: string | null;
}

export const contentReviewKeys = {
  all: ["content-review"] as const,
  list: (params: ContentAssetFilters) => ["content-review", "list", params] as const,
  detail: (id: string) => ["content-review", "detail", id] as const,
  reviews: (id: string) => ["content-review", "reviews", id] as const,
};

export function useContentAssets(params: ContentAssetFilters) {
  return useQuery({
    queryKey: contentReviewKeys.list(params),
    queryFn: () =>
      apiFetchList<ContentAssetDto>("/content-assets", {
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

export function useContentAsset(id: string | null) {
  return useQuery({
    queryKey: id ? contentReviewKeys.detail(id) : ["content-review", "empty"],
    queryFn: () => apiFetch<ContentAssetDto>(`/content-assets/${id}`),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.pending_workflow_run_id ? 3000 : false),
  });
}

export function useContentReviews(id: string | null) {
  return useQuery({
    queryKey: id ? contentReviewKeys.reviews(id) : ["content-review", "reviews", "empty"],
    queryFn: () => apiFetch<ContentReviewDto[]>(`/content-assets/${id}/reviews`),
    enabled: !!id,
  });
}

function useInvalidateContent() {
  const queryClient = useQueryClient();
  return (id?: string | null) => {
    void queryClient.invalidateQueries({ queryKey: contentReviewKeys.all });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: contentReviewKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: contentReviewKeys.reviews(id) });
    }
  };
}

export function useCreateContentAsset() {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: (input: ContentAssetCreateInput) =>
      apiFetch<ContentAssetDto>("/content-assets", { method: "POST", body: input }),
    onSuccess: (asset) => {
      toast.success("内容已提交");
      invalidate(asset.id);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useStartContentReview() {
  const invalidate = useInvalidateContent();
  return useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction?: string | null }) =>
      apiFetch<StartWorkflowResponseDto>(`/content-assets/${id}/reviews`, {
        method: "POST",
        body: { instruction },
      }),
    onSuccess: (_run, vars) => {
      toast.success("AI 内容审核已启动");
      invalidate(vars.id);
    },
    onError: (err) => toast.error(err.message),
  });
}
