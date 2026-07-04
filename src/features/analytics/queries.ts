"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { StartWorkflowResponseDto } from "@/shared/schemas/workflow";
import type {
  AnalyticsOverviewDto,
  InsightDto,
  ReportDto,
} from "@/shared/schemas/content-analytics";

export interface AnalyticsFilters {
  campaign_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface ReportFilters {
  campaign_id?: string;
  status?: string;
  cursor?: string | null;
}

export const analyticsKeys = {
  overview: (params: AnalyticsFilters) => ["analytics", "overview", params] as const,
  insights: (params: AnalyticsFilters) => ["analytics", "insights", params] as const,
  reportsAll: ["reports"] as const,
  reports: (params: ReportFilters) => ["reports", "list", params] as const,
  report: (id: string) => ["reports", "detail", id] as const,
};

export function useAnalyticsOverview(params: AnalyticsFilters) {
  return useQuery({
    queryKey: analyticsKeys.overview(params),
    queryFn: () =>
      apiFetch<AnalyticsOverviewDto>("/metrics", {
        params: {
          campaign_id: params.campaign_id,
          date_from: params.date_from,
          date_to: params.date_to,
        },
      }),
  });
}

export function useInsights(params: AnalyticsFilters & { status?: string }) {
  return useQuery({
    queryKey: analyticsKeys.insights(params),
    queryFn: () =>
      apiFetchList<InsightDto>("/insights", {
        params: {
          campaign_id: params.campaign_id,
          status: params.status,
          limit: 20,
        },
      }),
  });
}

export function useReports(params: ReportFilters) {
  return useQuery({
    queryKey: analyticsKeys.reports(params),
    queryFn: () =>
      apiFetchList<ReportDto>("/reports", {
        params: {
          campaign_id: params.campaign_id,
          status: params.status,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useReport(id: string | null) {
  return useQuery({
    queryKey: id ? analyticsKeys.report(id) : ["reports", "empty"],
    queryFn: () => apiFetch<ReportDto>(`/reports/${id}`),
    enabled: !!id,
  });
}

export function useGenerateAnalytics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { campaign_id: string; date_from?: string | null; date_to?: string | null }) =>
      apiFetch<StartWorkflowResponseDto>("/insights/generate", { method: "POST", body: input }),
    onSuccess: () => {
      toast.success("分析工作流已启动");
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.reportsAll });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useTransitionReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: string; reason?: string | null }) =>
      apiFetch<ReportDto>(`/reports/${id}/status`, { method: "POST", body: { to, reason } }),
    onSuccess: (report) => {
      toast.success("报告状态已更新");
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.reportsAll });
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.report(report.id) });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, content }: { id: string; title?: string; content?: Record<string, unknown> }) =>
      apiFetch<ReportDto>(`/reports/${id}`, { method: "PATCH", body: { title, content } }),
    onSuccess: (report) => {
      toast.success("报告已保存");
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.reportsAll });
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.report(report.id) });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useExportReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<ReportDto>(`/reports/${id}/export`, { method: "POST" }),
    onSuccess: (report) => {
      toast.success("报告已标记导出");
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.reportsAll });
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.report(report.id) });
    },
    onError: (err) => toast.error(err.message),
  });
}
