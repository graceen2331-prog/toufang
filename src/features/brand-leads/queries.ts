"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type {
  BrandLeadCreateInput,
  BrandLeadConvertInput,
  BrandLeadConversionDto,
  BrandLeadDto,
  BrandLeadStatsDto,
} from "@/shared/schemas/brand-lead";

export interface BrandLeadFilters {
  q?: string;
  country?: string;
  category?: string;
  tier?: string;
  seeking_funding?: boolean;
  cursor?: string | null;
  limit?: number;
}

export function useConvertBrandLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BrandLeadConvertInput }) =>
      apiFetch<BrandLeadConversionDto>(`/brand-leads/${id}/convert`, {
        method: "POST",
        body: input,
      }),
    onSuccess: (result) => {
      toast.success(
        result.already_converted
          ? `已打开 Campaign「${result.campaign_name}」`
          : `Campaign「${result.campaign_name}」已创建`,
      );
      void queryClient.invalidateQueries({ queryKey: brandLeadKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["brands"] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

export const brandLeadKeys = {
  all: ["brand-leads"] as const,
  list: (params: BrandLeadFilters) => ["brand-leads", "list", params] as const,
  stats: () => ["brand-leads", "stats"] as const,
  detail: (id: string) => ["brand-leads", "detail", id] as const,
};

export function useBrandLeads(params: BrandLeadFilters) {
  return useQuery({
    queryKey: brandLeadKeys.list(params),
    queryFn: () =>
      apiFetchList<BrandLeadDto>("/brand-leads", {
        params: {
          q: params.q,
          country: params.country,
          category: params.category,
          tier: params.tier,
          seeking_funding: params.seeking_funding,
          cursor: params.cursor,
          limit: params.limit ?? 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useBrandLeadStats() {
  return useQuery({
    queryKey: brandLeadKeys.stats(),
    queryFn: () => apiFetch<BrandLeadStatsDto>("/brand-leads/stats"),
  });
}

export function useUpsertBrandLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BrandLeadCreateInput) =>
      apiFetch<BrandLeadDto>("/brand-leads", { method: "POST", body: input }),
    onSuccess: (lead) => {
      toast.success(`品牌线索「${lead.name}」已保存`);
      void queryClient.invalidateQueries({ queryKey: brandLeadKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
