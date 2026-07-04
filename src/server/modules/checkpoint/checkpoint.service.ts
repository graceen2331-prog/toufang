import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { getUserNames } from "@/server/modules/user/user.repository";
import { checkpointRepository, type CheckpointListParams } from "./checkpoint.repository";
import type { HumanCheckpoint } from "@/generated/prisma/client";
import type { CheckpointDto } from "@/shared/schemas/checkpoint";

async function toDto(cp: HumanCheckpoint, names: Map<string, string>): Promise<CheckpointDto> {
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
    decided_by_name: cp.decidedBy ? (names.get(cp.decidedBy) ?? null) : null,
    decided_at: cp.decidedAt?.toISOString() ?? null,
    decision_reason: cp.decisionReason,
    created_at: cp.createdAt.toISOString(),
  };
}

export async function listCheckpoints(
  ctx: TenantCtx,
  params: CheckpointListParams,
): Promise<{ items: CheckpointDto[]; pagination: Pagination }> {
  const rows = await checkpointRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  const names = await getUserNames(items.map((c) => c.decidedBy).filter((v): v is string => !!v));
  return { items: await Promise.all(items.map((c) => toDto(c, names))), pagination };
}

export async function countPendingCheckpoints(ctx: TenantCtx): Promise<number> {
  return checkpointRepository.countPending(ctx);
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
): Promise<CheckpointDto> {
  const checkpoint = await checkpointRepository.findById(ctx, id);
  if (!checkpoint) throw new ApiError("RESOURCE_NOT_FOUND", "审批项不存在");
  if (checkpoint.status !== "pending") throw new ApiError("APPROVAL_ALREADY_DECIDED");
  if (decision !== "approved" && !reason?.trim()) {
    throw new ApiError("VALIDATION_FAILED", "驳回或要求修改时必须填写原因");
  }

  const decided = await checkpointRepository.decide(ctx, id, decision, reason?.trim() || null);
  if (!decided) throw new ApiError("APPROVAL_ALREADY_DECIDED");

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

  const updated = await checkpointRepository.findById(ctx, id);
  const names = await getUserNames(updated?.decidedBy ? [updated.decidedBy] : []);
  return toDto(updated!, names);
}
