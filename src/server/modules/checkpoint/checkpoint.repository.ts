import "server-only";
import { prisma } from "@/server/db/client";
import type { HumanCheckpoint, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface CheckpointListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  type: string | null;
  campaignId?: string | null;
  assignee?: string | null;
  createdBy?: string | null;
  overdue?: boolean;
  priority?: string | null;
}

export interface CampaignCheckpointRefs {
  campaignCreatorIds: string[];
  contentAssetIds: string[];
  contractIds: string[];
  outreachMessageIds: string[];
  paymentRecordIds: string[];
  reportIds: string[];
}

function idsCondition(ids: string[]): { in: string[] } | undefined {
  return ids.length > 0 ? { in: ids } : undefined;
}

export function buildCampaignCheckpointWhere(
  campaignId: string,
  refs: CampaignCheckpointRefs,
): Prisma.HumanCheckpointWhereInput {
  const workflowSubjects: Prisma.WorkflowRunWhereInput[] = [
    { subjectType: "campaign", subjectId: campaignId },
  ];
  const ors: Prisma.HumanCheckpointWhereInput[] = [
    { entityType: "campaign", entityId: campaignId },
  ];

  const campaignCreatorIds = idsCondition(refs.campaignCreatorIds);
  if (campaignCreatorIds) {
    ors.push({ entityType: "campaign_creator", entityId: campaignCreatorIds });
    workflowSubjects.push({ subjectType: "campaign_creator", subjectId: campaignCreatorIds });
  }

  const outreachMessageIds = idsCondition(refs.outreachMessageIds);
  if (outreachMessageIds) {
    ors.push({ entityType: "outreach_message", entityId: outreachMessageIds });
  }

  const contractIds = idsCondition(refs.contractIds);
  if (contractIds) ors.push({ entityType: "contract", entityId: contractIds });

  const paymentRecordIds = idsCondition(refs.paymentRecordIds);
  if (paymentRecordIds) ors.push({ entityType: "payment_record", entityId: paymentRecordIds });

  const contentAssetIds = idsCondition(refs.contentAssetIds);
  if (contentAssetIds) {
    ors.push({ entityType: "content_asset", entityId: contentAssetIds });
    workflowSubjects.push({ subjectType: "content_asset", subjectId: contentAssetIds });
  }

  const reportIds = idsCondition(refs.reportIds);
  if (reportIds) ors.push({ entityType: "report", entityId: reportIds });

  ors.push({
    workflowRun: {
      is: {
        OR: workflowSubjects,
      },
    },
  });

  return { OR: ors };
}

async function collectCampaignCheckpointRefs(
  ctx: TenantCtx,
  campaignId: string,
): Promise<CampaignCheckpointRefs> {
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
    select: { id: true },
  });
  const campaignCreatorIds = campaignCreators.map((item) => item.id);

  const [threads, contentAssets, contracts, reports] = await Promise.all([
    campaignCreatorIds.length
      ? prisma.outreachThread.findMany({
          where: {
            tenantId: ctx.orgId,
            campaignCreatorId: { in: campaignCreatorIds },
            deletedAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    campaignCreatorIds.length
      ? prisma.contentAsset.findMany({
          where: {
            tenantId: ctx.orgId,
            campaignCreatorId: { in: campaignCreatorIds },
            deletedAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    campaignCreatorIds.length
      ? prisma.contract.findMany({
          where: {
            tenantId: ctx.orgId,
            campaignCreatorId: { in: campaignCreatorIds },
            deletedAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.report.findMany({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const threadIds = threads.map((item) => item.id);
  const contractIds = contracts.map((item) => item.id);
  const [messages, payments] = await Promise.all([
    threadIds.length
      ? prisma.outreachMessage.findMany({
          where: { tenantId: ctx.orgId, threadId: { in: threadIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    contractIds.length
      ? prisma.paymentRecord.findMany({
          where: { tenantId: ctx.orgId, contractId: { in: contractIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    campaignCreatorIds,
    contentAssetIds: contentAssets.map((item) => item.id),
    contractIds,
    outreachMessageIds: messages.map((item) => item.id),
    paymentRecordIds: payments.map((item) => item.id),
    reportIds: reports.map((item) => item.id),
  };
}

export const checkpointRepository = {
  async canUserDecide(ctx: TenantCtx, checkpoint: HumanCheckpoint, userId: string | null): Promise<boolean> {
    if (!userId) return false;
    if (checkpoint.assigneeId) return checkpoint.assigneeId === userId;
    // 角色审批池的权限已由 API 的 approval:decide 门禁校验；内部工作流调用也保持向后兼容。
    if (!checkpoint.assigneeRole) return true;
    const membership = await prisma.membership.findFirst({
      where: { tenantId: ctx.orgId, userId, status: "active", deletedAt: null },
      include: { role: { select: { key: true, permissions: true } } },
    });
    if (!membership) return true;
    const permissions = Array.isArray(membership.role.permissions)
      ? (membership.role.permissions as unknown[]).map(String)
      : [];
    if (permissions.includes("*")) return true;
    if (!permissions.includes("approval:decide")) return false;
    return !checkpoint.assigneeRole || checkpoint.assigneeRole === membership.role.key;
  },

  async canUserReceive(ctx: TenantCtx, checkpoint: HumanCheckpoint, userId: string): Promise<boolean> {
    return this.canUserDecide(ctx, { ...checkpoint, assigneeId: null }, userId);
  },
  async list(ctx: TenantCtx, params: CheckpointListParams): Promise<HumanCheckpoint[]> {
    const campaignWhere = params.campaignId
      ? buildCampaignCheckpointWhere(
          params.campaignId,
          await collectCampaignCheckpointRefs(ctx, params.campaignId),
        )
      : {};

    return prisma.humanCheckpoint.findMany({
      where: {
        tenantId: ctx.orgId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.priority ? { priority: params.priority } : {}),
        ...(params.assignee === "me" && ctx.userId ? { assigneeId: ctx.userId } : {}),
        ...(params.assignee === "unassigned" ? { assigneeId: null } : {}),
        ...(params.assignee && !["me", "unassigned"].includes(params.assignee)
          ? { assigneeId: params.assignee }
          : {}),
        ...(params.createdBy === "me" && ctx.userId ? { createdBy: ctx.userId } : {}),
        ...(params.overdue === true ? { dueAt: { lt: new Date() }, status: "pending" } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
        ...campaignWhere,
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async countPending(ctx: TenantCtx): Promise<number> {
    return prisma.humanCheckpoint.count({ where: { tenantId: ctx.orgId, status: "pending" } });
  },

  async findById(ctx: TenantCtx, id: string): Promise<HumanCheckpoint | null> {
    return prisma.humanCheckpoint.findFirst({ where: { id, tenantId: ctx.orgId } });
  },

  async listEvents(ctx: TenantCtx, checkpointId: string) {
    return prisma.humanCheckpointEvent.findMany({
      where: { tenantId: ctx.orgId, checkpointId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async create(
    ctx: TenantCtx,
    data: Omit<Prisma.HumanCheckpointUncheckedCreateInput, "tenantId">,
  ): Promise<HumanCheckpoint> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.humanCheckpoint.create({
        data: {
          ...data,
          tenantId: ctx.orgId,
          createdBy: data.createdBy ?? ctx.userId ?? null,
          dueAt: data.dueAt ?? new Date(Date.now() + dueHoursForPriority(data.priority ?? "normal") * 3600_000),
        },
      });
      await tx.humanCheckpointEvent.create({
        data: {
          tenantId: ctx.orgId,
          checkpointId: created.id,
          eventType: "created",
          actorId: ctx.userId ?? null,
          toStatus: created.status,
          toAssigneeId: created.assigneeId,
          metadata: { priority: created.priority },
        },
      });
      return created;
    });
  },

  /** 原子决策：仅 pending 可被决策（乐观并发保护） */
  async decide(
    ctx: TenantCtx,
    id: string,
    status: "approved" | "rejected" | "changes_requested",
    reason: string | null,
    expectedVersion?: number,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.humanCheckpoint.findFirst({ where: { id, tenantId: ctx.orgId } });
      if (!current || current.status !== "pending") return false;
      const result = await tx.humanCheckpoint.updateMany({
        where: {
          id,
          tenantId: ctx.orgId,
          status: "pending",
          ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
        },
        data: {
          status,
          decidedBy: ctx.userId ?? null,
          decidedAt: new Date(),
          decisionReason: reason,
          version: { increment: 1 },
        },
      });
      if (result.count === 0) return false;
      await tx.humanCheckpointEvent.create({
        data: {
          tenantId: ctx.orgId,
          checkpointId: id,
          eventType: "decided",
          actorId: ctx.userId ?? null,
          fromStatus: current.status,
          toStatus: status,
          fromAssigneeId: current.assigneeId,
          reason,
        },
      });
      return true;
    });
  },

  async transfer(ctx: TenantCtx, id: string, toUserId: string, reason: string, expectedVersion?: number) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.humanCheckpoint.findFirst({ where: { id, tenantId: ctx.orgId } });
      if (!current || current.status !== "pending") return { kind: "not_pending" as const };
      const updated = await tx.humanCheckpoint.updateMany({
        where: { id, tenantId: ctx.orgId, status: "pending", ...(expectedVersion === undefined ? {} : { version: expectedVersion }) },
        data: { assigneeId: toUserId, version: { increment: 1 } },
      });
      if (!updated.count) return { kind: "conflict" as const };
      await tx.humanCheckpointEvent.create({
        data: { tenantId: ctx.orgId, checkpointId: id, eventType: "reassigned", actorId: ctx.userId ?? null, fromAssigneeId: current.assigneeId, toAssigneeId: toUserId, reason },
      });
      return { kind: "transferred" as const };
    });
  },

  async escalate(ctx: TenantCtx, id: string, reason: string, targetUserId?: string | null, expectedVersion?: number) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.humanCheckpoint.findFirst({ where: { id, tenantId: ctx.orgId } });
      if (!current || current.status !== "pending") return { kind: "not_pending" as const };
      const nextPriority = current.priority === "urgent" ? "urgent" : current.priority === "high" ? "urgent" : "high";
      const updated = await tx.humanCheckpoint.updateMany({
        where: { id, tenantId: ctx.orgId, status: "pending", ...(expectedVersion === undefined ? {} : { version: expectedVersion }) },
        data: { escalationLevel: { increment: 1 }, lastEscalatedAt: new Date(), lastEscalatedBy: ctx.userId ?? null, priority: nextPriority, ...(targetUserId ? { assigneeId: targetUserId } : {}), version: { increment: 1 } },
      });
      if (!updated.count) return { kind: "conflict" as const };
      await tx.humanCheckpointEvent.create({
        data: { tenantId: ctx.orgId, checkpointId: id, eventType: "escalated", actorId: ctx.userId ?? null, fromAssigneeId: current.assigneeId, toAssigneeId: targetUserId ?? current.assigneeId, reason, metadata: { priority: nextPriority } },
      });
      return { kind: "escalated" as const };
    });
  },
};

function dueHoursForPriority(priority: string): number {
  return priority === "urgent" ? 4 : priority === "high" ? 24 : priority === "low" ? 120 : 48;
}
