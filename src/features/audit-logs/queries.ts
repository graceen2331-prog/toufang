"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchList } from "@/lib/api";
import type { AuditLogDto } from "@/shared/schemas/audit-log";

export interface AuditLogFilters {
  actor_id?: string;
  entity_type?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  cursor?: string | null;
}

export const auditLogKeys = {
  list: (params: AuditLogFilters) => ["audit-logs", params] as const,
};

export function useAuditLogs(params: AuditLogFilters) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () =>
      apiFetchList<AuditLogDto>("/audit-logs", {
        params: {
          actor_id: params.actor_id,
          entity_type: params.entity_type,
          action: params.action,
          date_from: params.date_from,
          date_to: params.date_to,
          cursor: params.cursor,
          limit: 20,
        },
      }),
    placeholderData: (prev) => prev,
  });
}
