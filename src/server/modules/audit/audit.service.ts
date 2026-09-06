import "server-only";
import { prisma } from "@/server/db/client";

export interface AuditEntry {
  tenantId: string;
  requestId?: string | null;
  actorType: "user" | "system" | "agent";
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/** 写审计日志；失败不抛出（不阻塞业务主流程），仅打印错误 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        requestId: entry.requestId ?? null,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? {}) as object,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] 审计日志写入失败", entry.action, err);
  }
}
