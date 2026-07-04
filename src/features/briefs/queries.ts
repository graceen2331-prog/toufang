"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { BriefContent, BriefDto, BriefVersionDto } from "@/shared/schemas/brief";

export const briefKeys = {
  all: ["briefs"] as const,
  byCampaign: (campaignId: string) => ["briefs", "campaign", campaignId] as const,
  version: (briefId: string, versionId: string) =>
    ["briefs", "version", briefId, versionId] as const,
};

// ---------------------------------------------------------------
// 查询
// ---------------------------------------------------------------

/** Campaign 当前 Brief；data 为 null 表示还没有 Brief */
export function useCampaignBrief(campaignId: string) {
  return useQuery({
    queryKey: briefKeys.byCampaign(campaignId),
    queryFn: () => apiFetch<BriefDto | null>(`/campaigns/${campaignId}/brief`),
  });
}

/** 查看历史版本全文（仅在打开查看时启用） */
export function useBriefVersion(briefId: string, versionId: string, enabled: boolean) {
  return useQuery({
    queryKey: briefKeys.version(briefId, versionId),
    queryFn: () => apiFetch<BriefVersionDto>(`/briefs/${briefId}/versions/${versionId}`),
    enabled,
  });
}

// ---------------------------------------------------------------
// 变更
// ---------------------------------------------------------------

/** 人工保存新版本（status 回 draft） */
export function useSaveBriefVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      content,
      change_summary,
    }: {
      campaignId: string;
      content: BriefContent;
      change_summary?: string | null;
    }) =>
      apiFetch<BriefDto>(`/campaigns/${campaignId}/brief`, {
        method: "POST",
        body: { content, change_summary },
      }),
    onSuccess: () => {
      toast.success("已保存新版本");
      void queryClient.invalidateQueries({ queryKey: briefKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Brief 状态流转（draft→in_review→approved→locked→archived） */
export function useTransitionBriefStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ briefId, to, reason }: { briefId: string; to: string; reason?: string }) =>
      apiFetch<{ updated: boolean }>(`/briefs/${briefId}/status`, {
        method: "POST",
        body: { to, reason },
      }),
    onSuccess: () => {
      toast.success("Brief 状态已更新");
      void queryClient.invalidateQueries({ queryKey: briefKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
