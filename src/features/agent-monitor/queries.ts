"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch, apiFetchList } from "@/lib/api";
import type {
  AgentInfrastructureDto,
  AgentMonitorSummaryDto,
  AgentRunDetailDto,
  AgentRunListItemDto,
  AgentRunSensitiveDto,
} from "@/shared/schemas/agent-monitor";

export interface AgentRunFilters {
  status?: string;
  agent_key?: string;
  provider?: string;
  model?: string;
  mode?: string;
  anomaly?: string;
  date_from?: string;
  date_to?: string;
  cursor?: string | null;
}

export const agentMonitorKeys = {
  all: ["agent-monitor"] as const,
  summary: ["agent-monitor", "summary"] as const,
  infrastructure: ["agent-monitor", "infrastructure"] as const,
  list: (params: AgentRunFilters) => ["agent-monitor", "list", params] as const,
  detail: (id: string) => ["agent-monitor", "detail", id] as const,
};

export function useAgentMonitorSummary() {
  return useQuery({
    queryKey: agentMonitorKeys.summary,
    queryFn: () => apiFetch<AgentMonitorSummaryDto>("/agent-monitor/summary"),
    refetchInterval: 5_000,
  });
}

export function useAgentInfrastructure() {
  return useQuery({
    queryKey: agentMonitorKeys.infrastructure,
    queryFn: () => apiFetch<AgentInfrastructureDto>("/agent-monitor/infrastructure"),
    refetchInterval: 5_000,
  });
}

export function useAgentRuns(params: AgentRunFilters) {
  return useQuery({
    queryKey: agentMonitorKeys.list(params),
    queryFn: () =>
      apiFetchList<AgentRunListItemDto>("/agent-runs", {
        params: { ...params, limit: 20 },
      }),
    placeholderData: (previous) => previous,
    refetchInterval: 5_000,
  });
}

export function useAgentRun(id: string) {
  return useQuery({
    queryKey: agentMonitorKeys.detail(id),
    queryFn: () => apiFetch<AgentRunDetailDto>(`/agent-runs/${id}`),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3_000 : false),
  });
}

/** 敏感上下文按需读取，不进入 Query 缓存。 */
export function useAgentRunSensitive() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AgentRunSensitiveDto>(`/agent-runs/${id}/sensitive`),
  });
}
