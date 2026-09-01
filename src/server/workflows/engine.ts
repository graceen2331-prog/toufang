import "server-only";
import { prisma } from "@/server/db/client";
import { publishWorkflowEvent } from "@/server/events/pubsub";
import { getWorkflowStepQueue } from "@/server/jobs/queues";
import { ApiError } from "@/server/api/envelope";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { workflowLifecycleRepository } from "@/server/modules/workflow/workflow-lifecycle.repository";
import type { WorkflowRun } from "@/generated/prisma/client";

// ============================================================
// 工作流定义模型：步骤顺序硬编码在代码里（Orchestrator 不用 LLM）
// ============================================================

export interface StepContext {
  tenantId: string;
  runId: string;
  run: WorkflowRun;
  /** 前序步骤输出：stepKey → output */
  outputs: Record<string, unknown>;
  createdBy: string | null;
}

export interface CheckpointSpec {
  type: string;
  title: (ctx: StepContext, stepOutput: unknown) => string;
  summary?: (ctx: StepContext, stepOutput: unknown) => string;
  payload?: (ctx: StepContext, stepOutput: unknown) => Record<string, unknown>;
  priority?: "low" | "normal" | "high" | "urgent";
  assigneeRole?: string;
}

export interface WorkflowStepDefinition {
  key: string;
  label: string;
  run: (ctx: StepContext) => Promise<Record<string, unknown>>;
  /** 步骤完成后需要人工审批才能继续 */
  checkpoint?: CheckpointSpec;
}

export interface WorkflowDefinition {
  key: string;
  label: string;
  steps: WorkflowStepDefinition[];
  /**
   * 允许手动新建运行重试的失败步骤白名单。
   * 只能列出尚未产生业务副作用的步骤；落库、外发、付款和正式报告步骤一律不得列入。
   */
  manualRetrySafeStepKeys?: readonly string[];
  /** 审批被驳回时的收尾处理（可选） */
  onRejected?: (ctx: StepContext, reason: string | null) => Promise<void>;
  /** 全部步骤完成后的收尾处理（可选） */
  onCompleted?: (ctx: StepContext) => Promise<void>;
}

const definitions = new Map<string, WorkflowDefinition>();

export function registerWorkflow(def: WorkflowDefinition): void {
  definitions.set(def.key, def);
}

export function getWorkflowDefinition(key: string): WorkflowDefinition {
  const def = definitions.get(key);
  if (!def) throw new Error(`未注册的工作流: ${key}`);
  return def;
}

// 注册全部工作流定义（新增工作流在 ./definitions/index.ts 中登记）
import { registerAllWorkflows } from "./definitions";
registerAllWorkflows(registerWorkflow);

// ============================================================
// 引擎：启动 / 推进 / 审批恢复
// ============================================================

export interface StartWorkflowInput {
  key: string;
  subjectType?: string;
  subjectId?: string;
  input?: Record<string, unknown>;
}

/** 启动工作流：建 run + steps → 入队第一步 */
export async function startWorkflow(
  ctx: TenantCtx,
  options: StartWorkflowInput,
): Promise<WorkflowRun> {
  const def = getWorkflowDefinition(options.key);

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowRun.create({
      data: {
        tenantId: ctx.orgId,
        workflowKey: def.key,
        status: "queued",
        subjectType: options.subjectType ?? null,
        subjectId: options.subjectId ?? null,
        input: (options.input ?? {}) as object,
        createdBy: ctx.userId ?? null,
      },
    });
    await tx.workflowStep.createMany({
      data: def.steps.map((step, i) => ({
        tenantId: ctx.orgId,
        runId: created.id,
        stepKey: step.key,
        stepOrder: i,
        status: "pending",
      })),
    });
    return created;
  });

  await enqueueStep(ctx.orgId, run.id, def.steps[0]!.key);
  await publishWorkflowEvent(run.id, { type: "run_status", status: "queued" });
  return run;
}

async function enqueueStep(tenantId: string, runId: string, stepKey: string): Promise<void> {
  await getWorkflowStepQueue().add(
    `${runId}.${stepKey}`,
    { tenantId, runId, stepKey },
    { jobId: `${runId}.${stepKey}` }, // 幂等：同一步骤同一时刻只有一个 job（jobId 不允许冒号）
  );
}

async function notifyWorkflowUser(input: {
  tenantId: string;
  userId: string | null;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  priority?: string;
}): Promise<void> {
  if (!input.userId) return;
  try {
    const { createNotificationForUser } = await import("@/server/modules/notification/notification.service");
    await createNotificationForUser({
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      priority: input.priority,
    });
  } catch (err) {
    console.error("[workflow] 通知写入失败", err);
  }
}

async function notifyCheckpointRole(input: {
  tenantId: string;
  roleKey: string | null;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  priority?: string;
}): Promise<void> {
  if (!input.roleKey) return;
  try {
    const { notifyRole } = await import("@/server/modules/notification/notification.service");
    await notifyRole({
      tenantId: input.tenantId,
      roleKey: input.roleKey,
      type: "approval_pending",
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      priority: input.priority,
    });
  } catch (err) {
    console.error("[workflow] 审批通知写入失败", err);
  }
}

async function collectOutputs(runId: string): Promise<Record<string, unknown>> {
  const steps = await prisma.workflowStep.findMany({
    where: { runId, status: "completed" },
    select: { stepKey: true, output: true },
  });
  return Object.fromEntries(steps.map((s) => [s.stepKey, s.output]));
}

/**
 * 执行单个步骤（worker 调用）。幂等：completed/waiting 的步骤直接跳过。
 * attempt 由 BullMQ 管理（attempts=3 指数退避），最终失败在 onStepFailed 落库。
 */
export async function executeStep(tenantId: string, runId: string, stepKey: string): Promise<void> {
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) {
    console.warn(`[workflow] 忽略孤儿队列任务：run=${runId} step=${stepKey} 不存在`);
    return;
  }
  if (["cancelled", "failed", "completed"].includes(run.status)) return;

  const def = getWorkflowDefinition(run.workflowKey);
  const stepDef = def.steps.find((s) => s.key === stepKey);
  const stepRow = await prisma.workflowStep.findFirst({ where: { runId, stepKey } });
  if (!stepDef || !stepRow) throw new Error(`workflow step ${stepKey} 不存在`);
  if (["completed", "waiting_for_human", "skipped"].includes(stepRow.status)) return;

  const runReady = await workflowLifecycleRepository.ensureRunRunning(tenantId, runId);
  if (!runReady) return;
  if (run.status !== "running") {
    await publishWorkflowEvent(runId, { type: "run_status", status: "running" });
  }
  const stepStarted = await workflowLifecycleRepository.startStep({
    tenantId,
    runId,
    stepId: stepRow.id,
    stepKey,
  });
  if (!stepStarted) return;
  await publishWorkflowEvent(runId, {
    type: "step_status",
    step_key: stepKey,
    step_status: "running",
  });

  const ctx: StepContext = {
    tenantId,
    runId,
    run,
    outputs: await collectOutputs(runId),
    createdBy: run.createdBy,
  };

  const output = await stepDef.run(ctx); // 抛错则由 BullMQ 重试 / onStepFailed 收尾

  if (stepDef.checkpoint) {
    const cp = stepDef.checkpoint;
    const checkpoint = await workflowLifecycleRepository.waitForCheckpoint({
      tenantId,
      runId,
      stepId: stepRow.id,
      stepKey,
      stepOutput: output,
      checkpoint: {
        type: cp.type,
        title: cp.title(ctx, output),
        summary: cp.summary?.(ctx, output) ?? null,
        entityType: run.subjectType,
        entityId: run.subjectId,
        payload: cp.payload?.(ctx, output) ?? {},
        priority: cp.priority ?? "normal",
        assigneeRole: cp.assigneeRole ?? null,
        createdBy: run.createdBy,
      },
    });
    if (!checkpoint) {
      console.info(`[workflow] 丢弃取消后的迟到步骤结果：run=${runId} step=${stepKey}`);
      return;
    }
    await publishWorkflowEvent(runId, {
      type: "step_status",
      step_key: stepKey,
      step_status: "waiting_for_human",
    });
    await publishWorkflowEvent(runId, { type: "run_status", status: "waiting_for_human" });
    await notifyCheckpointRole({
      tenantId,
      roleKey: checkpoint.assigneeRole,
      title: checkpoint.title,
      body: checkpoint.summary,
      linkUrl: "/approvals",
      priority: checkpoint.priority,
    });
    return;
  }

  const committed = await workflowLifecycleRepository.completeStep({
    tenantId,
    runId,
    stepId: stepRow.id,
    output,
  });
  if (!committed) {
    console.info(`[workflow] 丢弃取消后的迟到步骤结果：run=${runId} step=${stepKey}`);
    return;
  }
  await publishWorkflowEvent(runId, {
    type: "step_status",
    step_key: stepKey,
    step_status: "completed",
  });

  await advanceAfter(tenantId, runId, stepKey);
}

/** 推进到下一步或完成 run */
async function advanceAfter(tenantId: string, runId: string, completedStepKey: string): Promise<void> {
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, tenantId } });
  if (!run || run.status !== "running") return;
  const def = getWorkflowDefinition(run.workflowKey);
  const idx = def.steps.findIndex((s) => s.key === completedStepKey);
  const next = def.steps[idx + 1];

  if (next) {
    await enqueueStep(tenantId, runId, next.key);
    return;
  }

  // 全部完成
  const outputs = await collectOutputs(runId);
  const completed = await workflowLifecycleRepository.completeRun({
    tenantId,
    runId,
    output: outputs,
  });
  if (!completed) return;
  await publishWorkflowEvent(runId, { type: "run_status", status: "completed" });
  await notifyWorkflowUser({
    tenantId,
    userId: run.createdBy,
    type: "workflow_completed",
    title: `工作流已完成：${def.label}`,
    body: run.subjectType && run.subjectId ? `${run.subjectType} / ${run.subjectId}` : null,
    linkUrl: `/ai-runs/${runId}`,
  });
  if (def.onCompleted) {
    await def.onCompleted({ tenantId, runId, run, outputs, createdBy: run.createdBy });
  }
}

/** BullMQ 最终失败回调：标记步骤与 run 失败 */
export async function onStepFailed(
  tenantId: string,
  runId: string,
  stepKey: string,
  error: string,
): Promise<void> {
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) {
    console.warn(`[workflow] 忽略孤儿失败回调：run=${runId} step=${stepKey} 不存在`);
    return;
  }
  const stepRow = await prisma.workflowStep.findFirst({
    where: { tenantId, runId, stepKey },
    select: { id: true },
  });
  const failed = await workflowLifecycleRepository.failRun({
    tenantId,
    runId,
    stepId: stepRow?.id ?? null,
    error,
  });
  if (!failed) {
    console.info(`[workflow] 丢弃终态运行的迟到失败回调：run=${runId} step=${stepKey}`);
    return;
  }
  if (stepRow) {
    await publishWorkflowEvent(runId, {
      type: "step_status",
      step_key: stepKey,
      step_status: "failed",
    });
  }
  await publishWorkflowEvent(runId, { type: "run_status", status: "failed" });
  await notifyWorkflowUser({
    tenantId,
    userId: run?.createdBy ?? null,
    type: "workflow_failed",
    title: `工作流失败：${run?.workflowKey ?? stepKey}`,
    body: error,
    linkUrl: `/ai-runs/${runId}`,
    priority: "high",
  });
}

/** 手动重试失败的 run：旧运行保持终态，创建完整的新运行。 */
export async function retryWorkflow(ctx: TenantCtx, runId: string): Promise<WorkflowRun> {
  const source = await workflowLifecycleRepository.findRetrySource(ctx, runId);
  if (!source) throw new ApiError("RESOURCE_NOT_FOUND", "工作流不存在");
  const def = getWorkflowDefinition(source.workflowKey);
  const result = await workflowLifecycleRepository.createRetryRun({
    ctx,
    runId,
    safeStepKeys: def.manualRetrySafeStepKeys ?? [],
    steps: def.steps.map((step) => step.key),
  });
  if (result.kind === "not_found") throw new ApiError("RESOURCE_NOT_FOUND", "工作流不存在");
  if (result.kind === "not_failed") {
    throw new ApiError("WORKFLOW_NOT_RESUMABLE", "仅失败的工作流可重试");
  }
  if (result.kind === "unsafe_step") {
    throw new ApiError("WORKFLOW_NOT_RESUMABLE", "该失败步骤可能已产生业务影响，请从业务页面重新发起");
  }
  if (result.kind === "active_conflict") {
    throw new ApiError("CONFLICT", "同一业务对象已有进行中的工作流");
  }
  await enqueueStep(ctx.orgId, result.run.id, def.steps[0]!.key);
  await publishWorkflowEvent(result.run.id, { type: "run_status", status: "queued" });
  return result.run;
}

/** 取消运行中的工作流 */
export async function cancelWorkflow(ctx: TenantCtx, runId: string): Promise<void> {
  const result = await workflowLifecycleRepository.cancelRun(ctx, runId);
  if (result.kind === "not_found") throw new ApiError("RESOURCE_NOT_FOUND", "工作流不存在");
  if (result.kind !== "cancelled") {
    throw new ApiError("WORKFLOW_NOT_RESUMABLE", "工作流已结束");
  }
  await publishWorkflowEvent(runId, { type: "run_status", status: "cancelled" });
}

/**
 * 审批决策钩子（checkpoint.service 调用）：
 * approved → 标记等待中的步骤完成并推进；rejected/changes_requested → 终止 run。
 */
export async function onCheckpointDecided(
  ctx: TenantCtx,
  workflowRunId: string,
  checkpointId: string,
  decision: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  const run = await prisma.workflowRun.findFirst({
    where: { id: workflowRunId, tenantId: ctx.orgId },
  });
  if (!run || run.status !== "waiting_for_human") return;

  const waitingStep = await prisma.workflowStep.findFirst({
    where: { runId: workflowRunId, status: "waiting_for_human" },
    orderBy: { stepOrder: "asc" },
  });
  if (!waitingStep) return;

  if (decision === "approved") {
    const resumed = await workflowLifecycleRepository.approveWaitingStep({
      ctx,
      runId: workflowRunId,
      stepId: waitingStep.id,
    });
    if (!resumed) return;
    await publishWorkflowEvent(workflowRunId, {
      type: "step_status",
      step_key: waitingStep.stepKey,
      step_status: "completed",
    });
    await publishWorkflowEvent(workflowRunId, { type: "run_status", status: "running" });
    await advanceAfter(ctx.orgId, workflowRunId, waitingStep.stepKey);
    return;
  }

  // 驳回 / 要求修改：终止 run，交由定义的 onRejected 做业务收尾
  const checkpoint = await prisma.humanCheckpoint.findUnique({ where: { id: checkpointId } });
  const reason = `审批未通过：${checkpoint?.decisionReason ?? decision}`;
  const rejected = await workflowLifecycleRepository.rejectWaitingStep({
    ctx,
    runId: workflowRunId,
    stepId: waitingStep.id,
    reason,
  });
  if (!rejected) return;
  await publishWorkflowEvent(workflowRunId, {
    type: "step_status",
    step_key: waitingStep.stepKey,
    step_status: "failed",
  });
  await publishWorkflowEvent(workflowRunId, { type: "run_status", status: "cancelled" });
  const def = getWorkflowDefinition(run.workflowKey);
  if (def.onRejected) {
    await def.onRejected(
      {
        tenantId: ctx.orgId,
        runId: workflowRunId,
        run,
        outputs: await collectOutputs(workflowRunId),
        createdBy: run.createdBy,
      },
      checkpoint?.decisionReason ?? null,
    );
  }
}
