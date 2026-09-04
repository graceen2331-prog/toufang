"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiClientError, apiFetch, apiFetchList } from "@/lib/api";
import type { CampaignListItemDto } from "@/shared/schemas/campaign";
import type { CheckpointDto } from "@/shared/schemas/checkpoint";
import type {
  AnalyticsOverviewDto,
  ContentAssetDto,
  ReportDto,
} from "@/shared/schemas/content-analytics";
import type { ContractDto, OutreachThreadListItemDto } from "@/shared/schemas/outreach";
import {
  dashboardPermissionFingerprint,
  resolveDashboardPreset,
  type DashboardResource,
} from "./workspace-config";

export interface DashboardIdentity {
  orgId: string;
  userId: string;
  roleKey: string | null;
  permissions: string[];
}

function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiClientError && error.status === 403) return false;
  return failureCount < 2;
}

function dashboardQueryKey(identity: DashboardIdentity | null, resource: DashboardResource) {
  return [
    "dashboard",
    identity?.orgId ?? "pending-org",
    identity?.userId ?? "pending-user",
    dashboardPermissionFingerprint(identity?.permissions ?? []),
    resource,
  ] as const;
}

export function useDashboardQueries(identity: DashboardIdentity | null) {
  const preset = resolveDashboardPreset(identity?.roleKey, identity?.permissions ?? []);
  const resources = new Set(preset.resources);
  const enabled = (resource: DashboardResource) => Boolean(identity && resources.has(resource));

  const analytics = useQuery({
    queryKey: dashboardQueryKey(identity, "analytics"),
    queryFn: ({ signal }) => apiFetch<AnalyticsOverviewDto>("/metrics", { signal }),
    enabled: enabled("analytics"),
    retry: shouldRetry,
  });

  const campaigns = useQuery({
    queryKey: dashboardQueryKey(identity, "campaigns"),
    queryFn: ({ signal }) =>
      apiFetchList<CampaignListItemDto>("/campaigns", { params: { limit: 20 }, signal }),
    enabled: enabled("campaigns"),
    retry: shouldRetry,
  });

  const reports = useQuery({
    queryKey: dashboardQueryKey(identity, "reports"),
    queryFn: ({ signal }) =>
      apiFetchList<ReportDto>("/reports", {
        params: { status: "in_review", limit: 20 },
        signal,
      }),
    enabled: enabled("reports"),
    retry: shouldRetry,
  });

  const approvals = useQuery({
    queryKey: dashboardQueryKey(identity, "approvals"),
    queryFn: ({ signal }) =>
      apiFetchList<CheckpointDto>("/approvals", {
        params: { status: "pending", limit: 20 },
        signal,
      }),
    enabled: enabled("approvals"),
    retry: shouldRetry,
  });

  const outreach = useQuery({
    queryKey: dashboardQueryKey(identity, "outreach"),
    queryFn: ({ signal }) =>
      apiFetchList<OutreachThreadListItemDto>("/outreach", { params: { limit: 20 }, signal }),
    enabled: enabled("outreach"),
    retry: shouldRetry,
  });

  const content = useQuery({
    queryKey: dashboardQueryKey(identity, "content"),
    queryFn: ({ signal }) =>
      apiFetchList<ContentAssetDto>("/content-assets", { params: { limit: 20 }, signal }),
    enabled: enabled("content"),
    retry: shouldRetry,
  });

  const contracts = useQuery({
    queryKey: dashboardQueryKey(identity, "contracts"),
    queryFn: ({ signal }) =>
      apiFetchList<ContractDto>("/contracts", { params: { limit: 20 }, signal }),
    enabled: enabled("contracts"),
    retry: shouldRetry,
  });

  return { preset, analytics, campaigns, reports, approvals, outreach, content, contracts };
}
