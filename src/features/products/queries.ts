"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { ProductCreateInput, ProductDto, ProductUpdateInput } from "@/shared/schemas/product";

export const productKeys = {
  all: ["products"] as const,
  list: (params: { q?: string; brandId?: string }) => ["products", "list", params] as const,
};

export function useProducts(params: { q?: string; brandId?: string } = {}) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () =>
      apiFetchList<ProductDto>("/products", {
        params: { q: params.q, brand_id: params.brandId, limit: 100 },
      }),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductCreateInput) =>
      apiFetch<ProductDto>("/products", { method: "POST", body: input }),
    onSuccess: (product) => {
      toast.success(`产品「${product.name}」已创建`);
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductUpdateInput }) =>
      apiFetch<ProductDto>(`/products/${id}`, { method: "PATCH", body: input }),
    onSuccess: (product) => {
      toast.success(`产品「${product.name}」已更新`);
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("产品已删除");
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
