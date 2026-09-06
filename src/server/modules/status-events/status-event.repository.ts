import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { getUserNames } from "@/server/modules/user/user.repository";
import type { StatusEventDto } from "@/shared/schemas/common";

export interface RecordStatusEventInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  field?: string;
  fromValue: string | null;
  toValue: string;
  actorType?: "user" | "system" | "agent";
  actorId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/** 记录状态变更事件（可在事务内使用：传入 tx） */
export async function recordStatusEvent(
  input: RecordStatusEventInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.statusEvent.create({
    data: {
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field ?? "status",
      fromValue: input.fromValue,
      toValue: input.toValue,
      actorType: input.actorType ?? "user",
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
      metadata: (input.metadata ?? {}) as object,
    },
  });
}

/** 查询实体的状态历史（含操作人名称） */
export async function listStatusEvents(
  tenantId: string,
  entityType: string,
  entityId: string,
): Promise<StatusEventDto[]> {
  const events = await prisma.statusEvent.findMany({
    where: { tenantId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const nameMap = await getUserNames(
    events.map((e) => e.actorId).filter((v): v is string => !!v),
  );
  return events.map((e) => ({
    id: e.id,
    field: e.field,
    from_value: e.fromValue,
    to_value: e.toValue,
    actor_type: e.actorType,
    actor_name: e.actorId ? (nameMap.get(e.actorId) ?? null) : null,
    reason: e.reason,
    created_at: e.createdAt.toISOString(),
  }));
}
