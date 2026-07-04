import "server-only";
import { type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { getUserNames } from "@/server/modules/user/user.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import type { AuditLogDto } from "@/shared/schemas/audit-log";
import { auditRepository, type AuditLogListParams } from "./audit.repository";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function parseAuditDate(value: string | null, endOfDay = false): Date | null {
  const date = parseDate(value);
  if (date && endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

export async function listAuditLogs(
  ctx: TenantCtx,
  params: AuditLogListParams,
): Promise<{ items: AuditLogDto[]; pagination: Pagination }> {
  const rows = await auditRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  const names = await getUserNames(items.map((row) => row.actorId).filter((id): id is string => !!id));
  return {
    items: items.map((row) => ({
      id: row.id,
      request_id: row.requestId,
      actor_type: row.actorType,
      actor_id: row.actorId,
      actor_name: row.actorId ? (names.get(row.actorId) ?? null) : null,
      action: row.action,
      entity_type: row.entityType,
      entity_id: row.entityId,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      ip: row.ip,
      created_at: row.createdAt.toISOString(),
    })),
    pagination,
  };
}
