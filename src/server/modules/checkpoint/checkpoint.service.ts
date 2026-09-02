import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { getUserNames } from "@/server/modules/user/user.repository";
import { checkpointRepository, type CheckpointListParams } from "./checkpoint.repository";
import type { HumanCheckpoint } from "@/generated/prisma/client";
import type { CheckpointDecisionInput, CheckpointDto } from "@/shared/schemas/checkpoint";

async function toDto(cp: HumanCheckpoint, names: Map<string, string>): Promise<CheckpointDto> {
  const effectiveDue = cp.dueAt ?? new Date(cp.createdAt.getTime() + dueHoursForPriority(cp.priority) * 3600_000);
  const dueAt = effectiveDue.toISOString();
  const overdue = cp.status === "pending" && effectiveDue.getTime() < Date.now();
  return {
    id: cp.id,
    type: cp.type,
    status: cp.status,
    title: cp.title,
    summary: cp.summary,
    entity_type: cp.entityType,
    entity_id: cp.entityId,
    workflow_run_id: cp.workflowRunId,
    payload: (cp.payload as Record<string, unknown>) ?? {},
    priority: cp.priority,
    assignee_role: cp.assigneeRole,
    created_by_id: cp.createdBy,
    created_by_name: cp.createdBy ? (names.get(cp.createdBy) ?? null) : null,
    assignee_id: cp.assigneeId,
    assignee_name: cp.assigneeId ? (names.get(cp.assigneeId) ?? null) : null,
    due_at: dueAt,
    is_overdue: overdue,
    overdue_seconds: overdue ? Math.floor((Date.now() - effectiveDue.getTime()) / 1000) : 0,
    escalation_level: cp.escalationLevel ?? 0,
    last_escalated_at: cp.lastEscalatedAt?.toISOString() ?? null,
    last_escalated_by_name: cp.lastEscalatedBy ? (names.get(cp.lastEscalatedBy) ?? null) : null,
    version: cp.version ?? 0,
    decided_by_name: cp.decidedBy ? (names.get(cp.decidedBy) ?? null) : null,
    decided_at: cp.decidedAt?.toISOString() ?? null,
    decision_reason: cp.decisionReason,
    decision_metadata:
      cp.decisionMetadata && typeof cp.decisionMetadata === "object"
        ? (cp.decisionMetadata as Record<string, unknown>)
        : {},
    created_at: cp.createdAt.toISOString(),
  };
}

function dueHoursForPriority(priority: string): number {
  return priority === "urgent" ? 4 : priority === "high" ? 24 : priority === "low" ? 120 : 48;
}

export async function listCheckpoints(
  ctx: TenantCtx,
  params: CheckpointListParams,
): Promise<{ items: CheckpointDto[]; pagination: Pagination }> {
  const rows = await checkpointRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  const names = await getUserNames(
    items
      .flatMap((c) => [c.decidedBy, c.createdBy, c.assigneeId, c.lastEscalatedBy])
      .filter((v): v is string => !!v),
  );
  return { items: await Promise.all(items.map((c) => toDto(c, names))), pagination };
}

export async function countPendingCheckpoints(ctx: TenantCtx): Promise<number> {
  return checkpointRepository.countPending(ctx);
}

export async function listCheckpointEvents(ctx: TenantCtx, id: string) {
  const checkpoint = await checkpointRepository.findById(ctx, id);
  if (!checkpoint) throw new ApiError("RESOURCE_NOT_FOUND", "审批项不存在");
  const events = await checkpointRepository.listEvents(ctx, id);
  const names = await getUserNames(events.map((event) => event.actorId).filter((v): v is string => !!v));
  return events.map((event) => ({
    id: event.id,
    event_type: event.eventType,
    actor_name: event.actorId ? (names.get(event.actorId) ?? null) : null,
    from_status: event.fromStatus,
    to_status: event.toStatus,
    from_assignee_id: event.fromAssigneeId,
    to_assignee_id: event.toAssigneeId,
    reason: event.reason,
    metadata: (event.metadata as Record<string, unknown>) ?? {},
    created_at: event.createdAt.toISOString(),
  }));
}

/**
 * 审批决策。若 checkpoint 挂在工作流上，决策后由工作流引擎接管推进
 *（W4 接入：resumeWorkflowFromCheckpoint）。
 */
export async function decideCheckpoint(
  ctx: TenantCtx,
  id: string,
  decision: "approved" | "rejected" | "changes_requested",
  reason?: string | null,
  override?: CheckpointDecisionInput["override"],
  paymentConfirmation?: CheckpointDecisionInput["payment_confirmation"],
  canApprovePayment = false,
  expectedVersion?: number,
): Promise<CheckpointDto> {
  const checkpoint = await checkpointRepository.findById(ctx, id);
  if (!checkpoint) throw new ApiError("RESOURCE_NOT_FOUND", "审批项不存在");
  if (checkpoint.status !== "pending") throw new ApiError("APPROVAL_ALREADY_DECIDED");
  if (!reason?.trim()) {
    throw new ApiError("VALIDATION_FAILED", "所有审批决策都必须填写处理意见");
  }
  if (checkpointRepository.canUserDecide && !(await checkpointRepository.canUserDecide(ctx, checkpoint, ctx.userId ?? null))) {
    throw new ApiError("PERMISSION_DENIED", "当前用户不是该审批项的指定审批人或所属审批角色");
  }

  // 正式报告必须把 checkpoint 决策与报告状态/快照哈希写入同一事务。
  if (checkpoint.type === "report" && checkpoint.entityType === "report" && checkpoint.entityId) {
    const { decideReportCheckpoint } = await import(
      "@/server/modules/analytics/analytics.service"
    );
    const checkpointVersion = expectedVersion ?? checkpoint.version;
    await decideReportCheckpoint(
      ctx,
      checkpoint.id,
      checkpoint.entityId,
      decision,
      reason?.trim() || null,
      ...(checkpointVersion === undefined ? [] : [checkpointVersion]),
    );
    const updated = await checkpointRepository.findById(ctx, id);
    const names = await getUserNames(updated ? checkpointUserIds(updated) : []);
    return toDto(updated!, names);
  }

  if (
    checkpoint.type === "payment" &&
    checkpoint.entityType === "payment_record" &&
    checkpoint.entityId
  ) {
    const { decidePaymentCheckpoint } = await import(
      "@/server/modules/contract/contract.service"
    );
    const checkpointVersion = expectedVersion ?? checkpoint.version;
    await decidePaymentCheckpoint(
      ctx,
      checkpoint.id,
      decision,
      reason?.trim() || null,
      paymentConfirmation,
      canApprovePayment,
      ...(checkpointVersion === undefined ? [] : [checkpointVersion]),
    );
    const updated = await checkpointRepository.findById(ctx, id);
    const names = await getUserNames(updated ? checkpointUserIds(updated) : []);
    return toDto(updated!, names);
  }

  if (checkpoint.type === "content" && checkpoint.entityType === "content_asset") {
    const { decideContentCheckpoint } = await import("@/server/modules/content/content.service");
    await decideContentCheckpoint(ctx, checkpoint.id, {
      decision,
      reason: reason?.trim() || null,
      ...(expectedVersion ?? checkpoint.version) === undefined
        ? {}
        : { expected_version: expectedVersion ?? checkpoint.version },
      ...(override ? { override } : {}),
    });
  } else {
    const decided = await checkpointRepository.decide(ctx, id, decision, reason?.trim() || null, expectedVersion ?? checkpoint.version);
    if (!decided) throw new ApiError("APPROVAL_ALREADY_DECIDED");
  }

  // 工作流挂钩：W4 实现（动态 import 避免循环依赖；未实现时静默跳过）
  if (checkpoint.workflowRunId) {
    try {
      const { onCheckpointDecided } = await import("@/server/workflows/engine");
      await onCheckpointDecided(ctx, checkpoint.workflowRunId, id, decision);
    } catch (err) {
      // 引擎未就绪（W4 前）或推进失败：记录但不回滚审批决策
      console.error("[checkpoint] 工作流推进失败", err);
    }
  }

  if (
    checkpoint.type === "outreach_send" &&
    checkpoint.entityType === "outreach_message" &&
    checkpoint.entityId
  ) {
    const { onOutreachApprovalDecided } = await import(
      "@/server/modules/outreach/outreach.service"
    );
    await onOutreachApprovalDecided(ctx, checkpoint.entityId, decision);
  }

  if (checkpoint.type === "contract" && checkpoint.entityType === "contract" && checkpoint.entityId) {
    const { onContractApprovalDecided } = await import(
      "@/server/modules/contract/contract.service"
    );
    await onContractApprovalDecided(ctx, checkpoint.entityId, decision);
  }

  const updated = await checkpointRepository.findById(ctx, id);
  const names = await getUserNames(
    updated
      ? [updated.decidedBy, updated.createdBy, updated.assigneeId, updated.lastEscalatedBy].filter(
          (v): v is string => !!v,
        )
      : [],
  );
  return toDto(updated!, names);
}

function checkpointUserIds(cp: HumanCheckpoint): string[] {
  return [cp.decidedBy, cp.createdBy, cp.assigneeId, cp.lastEscalatedBy].filter(
    (v): v is string => !!v,
  );
}

export async function transferCheckpoint(
  ctx: TenantCtx,
  id: string,
  toUserId: string,
  reason: string,
  expectedVersion?: number,
): Promise<CheckpointDto> {
  if (!reason.trim()) throw new ApiError("VALIDATION_FAILED", "转交必须填写原因");
  const checkpoint = await checkpointRepository.findById(ctx, id);
  if (!checkpoint) throw new ApiError("RESOURCE_NOT_FOUND", "审批项不存在");
  if (checkpoint.status !== "pending") throw new ApiError("APPROVAL_ALREADY_DECIDED");
  if (checkpoint.assigneeId && checkpoint.assigneeId !== ctx.userId) {
    throw new ApiError("PERMISSION_DENIED", "只有当前审批人可以转交该审批项");
  }
  if (!(await checkpointRepository.canUserReceive(ctx, checkpoint, toUserId))) {
    throw new ApiError("VALIDATION_FAILED", "目标用户不具备该审批项的处理资格");
  }
  const result = await checkpointRepository.transfer(ctx, id, toUserId, reason.trim(), expectedVersion ?? checkpoint.version);
  if (result.kind !== "transferred") throw new ApiError("APPROVAL_ALREADY_DECIDED", "审批项已被其他人更新，请刷新");
  const updated = await checkpointRepository.findById(ctx, id);
  const names = await getUserNames(updated ? [updated.createdBy, updated.assigneeId].filter((v): v is string => !!v) : []);
  return toDto(updated!, names);
}

export async function escalateCheckpoint(
  ctx: TenantCtx,
  id: string,
  reason: string,
  targetUserId?: string | null,
  expectedVersion?: number,
): Promise<CheckpointDto> {
  if (!reason.trim()) throw new ApiError("VALIDATION_FAILED", "升级必须填写原因");
  const checkpoint = await checkpointRepository.findById(ctx, id);
  if (!checkpoint) throw new ApiError("RESOURCE_NOT_FOUND", "审批项不存在");
  if (checkpoint.status !== "pending") throw new ApiError("APPROVAL_ALREADY_DECIDED");
  if (targetUserId && !(await checkpointRepository.canUserReceive(ctx, checkpoint, targetUserId))) {
    throw new ApiError("VALIDATION_FAILED", "目标用户不具备该审批项的处理资格");
  }
  const result = await checkpointRepository.escalate(ctx, id, reason.trim(), targetUserId, expectedVersion ?? checkpoint.version);
  if (result.kind !== "escalated") throw new ApiError("APPROVAL_ALREADY_DECIDED", "审批项已被其他人更新，请刷新");
  const updated = await checkpointRepository.findById(ctx, id);
  const names = await getUserNames(updated ? [updated.createdBy, updated.assigneeId, updated.lastEscalatedBy].filter((v): v is string => !!v) : []);
  return toDto(updated!, names);
}
