"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { BrandCreateInput, BrandDto, BrandUpdateInput } from "@/shared/schemas/brand";

export const brandKeys = {
  all: ["brands"] as const,
  list: (params: { q?: string }) => ["brands", "list", params] as const,
  detail: (id: string) => ["brands", "detail", id] as const,
};

export function useBrands(params: { q?: string } = {}) {
  return useQuery({
    queryKey: brandKeys.list(params),
    queryFn: () => apiFetchList<BrandDto>("/brands", { params: { q: params.q, limit: 100 } }),
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BrandCreateInput) =>
      apiFetch<BrandDto>("/brands", { method: "POST", body: input }),
    onSuccess: (brand) => {
      toast.success(`品牌「${brand.name}」已创建`);
      void queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BrandUpdateInput }) =>
      apiFetch<BrandDto>(`/brands/${id}`, { method: "PATCH", body: input }),
    onSuccess: (brand) => {
      toast.success(`品牌「${brand.name}」已更新`);
      void queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: boolean }>(`/brands/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("品牌已删除");
      void queryClient.invalidateQueries({ queryKey: brandKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
