import "server-only";
import { prisma } from "@/server/db/client";
import { publishWorkflowEvent } from "@/server/events/pubsub";
import { getWorkflowStepQueue } from "@/server/jobs/queues";
import { ApiError } from "@/server/api/envelope";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import type { Prisma, WorkflowRun } from "@/generated/prisma/client";

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

async function setRunStatus(
  runId: string,
  status: string,
  extra: Prisma.WorkflowRunUncheckedUpdateInput = {},
): Promise<void> {
  await prisma.workflowRun.update({ where: { id: runId }, data: { status, ...extra } });
  await publishWorkflowEvent(runId, { type: "run_status", status });
}

async function setStepStatus(
  runId: string,
  stepId: string,
  stepKey: string,
  status: string,
  extra: Prisma.WorkflowStepUncheckedUpdateInput = {},
): Promise<void> {
  await prisma.workflowStep.update({ where: { id: stepId }, data: { status, ...extra } });
  await publishWorkflowEvent(runId, { type: "step_status", step_key: stepKey, step_status: status });
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
  if (!run) throw new Error(`workflow run ${runId} 不存在`);
  if (["cancelled", "failed", "completed"].includes(run.status)) return;

  const def = getWorkflowDefinition(run.workflowKey);
  const stepDef = def.steps.find((s) => s.key === stepKey);
  const stepRow = await prisma.workflowStep.findFirst({ where: { runId, stepKey } });
  if (!stepDef || !stepRow) throw new Error(`workflow step ${stepKey} 不存在`);
  if (["completed", "waiting_for_human", "skipped"].includes(stepRow.status)) return;

  if (run.status !== "running") {
    await setRunStatus(runId, "running", run.startedAt ? {} : { startedAt: new Date() });
  }
  await setStepStatus(runId, stepRow.id, stepKey, "running", {
    attempt: { increment: 1 },
    startedAt: new Date(),
  });

  const ctx: StepContext = {
    tenantId,
    runId,
    run,
    outputs: await collectOutputs(runId),
    createdBy: run.createdBy,
  };

  const output = await stepDef.run(ctx); // 抛错则由 BullMQ 重试 / onStepFailed 收尾

  await setStepStatus(runId, stepRow.id, stepKey, stepDef.checkpoint ? "waiting_for_human" : "completed", {
    output: output as object,
    ...(stepDef.checkpoint ? {} : { completedAt: new Date() }),
  });

  if (stepDef.checkpoint) {
    const cp = stepDef.checkpoint;
    const checkpoint = await prisma.humanCheckpoint.create({
      data: {
        tenantId,
        workflowRunId: runId,
        type: cp.type,
        status: "pending",
        title: cp.title(ctx, output),
        summary: cp.summary?.(ctx, output) ?? null,
        entityType: run.subjectType,
        entityId: run.subjectId,
        payload: (cp.payload?.(ctx, output) ?? {}) as object,
        priority: cp.priority ?? "normal",
        assigneeRole: cp.assigneeRole ?? null,
        createdBy: run.createdBy,
      },
    });
    await notifyCheckpointRole({
      tenantId,
      roleKey: checkpoint.assigneeRole,
      title: checkpoint.title,
      body: checkpoint.summary,
      linkUrl: "/approvals",
      priority: checkpoint.priority,
    });
    await setRunStatus(runId, "waiting_for_human");
    return;
  }

  await advanceAfter(tenantId, runId, stepKey);
}

/** 推进到下一步或完成 run */
async function advanceAfter(tenantId: string, runId: string, completedStepKey: string): Promise<void> {
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return;
  const def = getWorkflowDefinition(run.workflowKey);
  const idx = def.steps.findIndex((s) => s.key === completedStepKey);
  const next = def.steps[idx + 1];

  if (next) {
    await enqueueStep(tenantId, runId, next.key);
    return;
  }

  // 全部完成
  const outputs = await collectOutputs(runId);
  await setRunStatus(runId, "completed", {
    output: outputs as object,
    completedAt: new Date(),
  });
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
  const stepRow = await prisma.workflowStep.findFirst({ where: { runId, stepKey } });
  if (stepRow) {
    await setStepStatus(runId, stepRow.id, stepKey, "failed", {
      failureReason: error,
      completedAt: new Date(),
    });
  }
  await setRunStatus(runId, "failed", { failureReason: error, completedAt: new Date() });
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

/** 手动重试失败的 run：重置失败步骤 → 重新入队 */
export async function retryWorkflow(ctx: TenantCtx, runId: string): Promise<void> {
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, tenantId: ctx.orgId } });
  if (!run) throw new ApiError("RESOURCE_NOT_FOUND", "工作流不存在");
  if (run.status !== "failed") throw new ApiError("WORKFLOW_NOT_RESUMABLE", "仅失败的工作流可重试");
  const failedStep = await prisma.workflowStep.findFirst({
    where: { runId, status: "failed" },
    orderBy: { stepOrder: "asc" },
  });
  if (!failedStep) throw new ApiError("WORKFLOW_NOT_RESUMABLE", "找不到失败步骤");
  await prisma.workflowStep.update({
    where: { id: failedStep.id },
    data: { status: "pending", failureReason: null },
  });
  await setRunStatus(runId, "queued", { failureReason: null });
  // 重试用独立 jobId 避免与旧 job 冲突
  await getWorkflowStepQueue().add(
    `${runId}.${failedStep.stepKey}.retry-${Date.now()}`,
    { tenantId: ctx.orgId, runId, stepKey: failedStep.stepKey },
  );
}

/** 取消运行中的工作流 */
export async function cancelWorkflow(ctx: TenantCtx, runId: string): Promise<void> {
  const run = await prisma.workflowRun.findFirst({ where: { id: runId, tenantId: ctx.orgId } });
  if (!run) throw new ApiError("RESOURCE_NOT_FOUND", "工作流不存在");
  if (["completed", "failed", "cancelled"].includes(run.status)) {
    throw new ApiError("WORKFLOW_NOT_RESUMABLE", "工作流已结束");
  }
  await setRunStatus(runId, "cancelled", { completedAt: new Date() });
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
    await setStepStatus(workflowRunId, waitingStep.id, waitingStep.stepKey, "completed", {
      completedAt: new Date(),
    });
    await setRunStatus(workflowRunId, "running");
    await advanceAfter(ctx.orgId, workflowRunId, waitingStep.stepKey);
    return;
  }

  // 驳回 / 要求修改：终止 run，交由定义的 onRejected 做业务收尾
  const checkpoint = await prisma.humanCheckpoint.findUnique({ where: { id: checkpointId } });
  await setStepStatus(workflowRunId, waitingStep.id, waitingStep.stepKey, "failed", {
    failureReason: `审批未通过：${checkpoint?.decisionReason ?? decision}`,
    completedAt: new Date(),
  });
  await setRunStatus(workflowRunId, "cancelled", {
    failureReason: `审批未通过：${checkpoint?.decisionReason ?? decision}`,
    completedAt: new Date(),
  });
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
