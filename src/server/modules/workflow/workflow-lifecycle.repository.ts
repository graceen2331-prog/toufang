import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import { WORKFLOW_RUN_STATUS, assertTransition } from "@/shared/constants/status";

const ACTIVE_RUN_STATUSES = ["queued", "running", "waiting_for_human", "retrying"] as const;
const ACTIVE_STEP_STATUSES = ["pending", "running", "waiting_for_human"] as const;

type RunUpdate = {
  output?: Prisma.InputJsonValue;
  failureReason?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

interface TransitionRunInput {
  tenantId: string;
  runId: string;
  expected: readonly string[];
  to: string;
  data?: RunUpdate;
  actorId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

interface CheckpointInput {
  tenantId: string;
  runId: string;
  stepId: string;
  stepKey: string;
  stepOutput: Record<string, unknown>;
  checkpoint: {
    type: string;
    title: string;
    summary: string | null;
    entityType: string | null;
    entityId: string | null;
    payload: Record<string, unknown>;
    priority: string;
    assigneeRole: string | null;
    createdBy: string | null;
  };
}

async function transitionRun(input: TransitionRunInput): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.workflowRun.findFirst({
      where: { id: input.runId, tenantId: input.tenantId },
      select: { status: true },
    });
    if (!current || !input.expected.includes(current.status)) return false;

    assertTransition(WORKFLOW_RUN_STATUS, current.status, input.to);
    const updated = await tx.workflowRun.updateMany({
      where: { id: input.runId, tenantId: input.tenantId, status: current.status },
      data: { status: input.to, ...input.data },
    });
    if (updated.count !== 1) return false;

    await recordStatusEvent(
      {
        tenantId: input.tenantId,
        entityType: WORKFLOW_RUN_STATUS.entityType,
        entityId: input.runId,
        fromValue: current.status,
        toValue: input.to,
        actorType: input.actorId ? "user" : "system",
        actorId: input.actorId ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata,
      },
      tx,
    );
    return true;
  });
}

async function recordStepTransition(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    stepId: string;
    from: string;
    to: string;
    actorId?: string | null;
    reason?: string | null;
  },
): Promise<void> {
  await recordStatusEvent(
    {
      tenantId: input.tenantId,
      entityType: "workflow_step",
      entityId: input.stepId,
      fromValue: input.from,
      toValue: input.to,
      actorType: input.actorId ? "user" : "system",
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
    },
    tx,
  );
}

export const workflowLifecycleRepository = {
  /** 将排队/重试中的运行原子领取为运行中；已在运行视为幂等成功。 */
  async ensureRunRunning(tenantId: string, runId: string): Promise<boolean> {
    const run = await prisma.workflowRun.findFirst({
      where: { id: runId, tenantId },
      select: { status: true, startedAt: true },
    });
    if (!run) return false;
    if (run.status === "running") return true;
    if (!(["queued", "retrying"] as string[]).includes(run.status)) return false;

    return transitionRun({
      tenantId,
      runId,
      expected: [run.status],
      to: "running",
      data: run.startedAt ? {} : { startedAt: new Date() },
    });
  },

  /** 领取步骤。事务内锁定运行行，避免取消和步骤启动同时成功。 */
  async startStep(input: {
    tenantId: string;
    runId: string;
    stepId: string;
    stepKey: string;
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const activeRun = await tx.workflowRun.updateMany({
        where: { id: input.runId, tenantId: input.tenantId, status: "running" },
        data: { status: "running" },
      });
      if (activeRun.count !== 1) return false;

      const step = await tx.workflowStep.findFirst({
        where: {
          id: input.stepId,
          tenantId: input.tenantId,
          runId: input.runId,
          status: { in: ["pending", "running"] },
        },
        select: { status: true },
      });
      if (!step) return false;

      const updated = await tx.workflowStep.updateMany({
        where: { id: input.stepId, tenantId: input.tenantId, runId: input.runId, status: step.status },
        data: {
          status: "running",
          attempt: { increment: 1 },
          startedAt: new Date(),
        },
      });
      if (updated.count !== 1) return false;
      if (step.status !== "running") {
        await recordStepTransition(tx, {
          tenantId: input.tenantId,
          stepId: input.stepId,
          from: step.status,
          to: "running",
        });
      }
      return true;
    });
  },

  /** 仅当运行仍处于 running 且步骤仍处于 running 时提交步骤结果。 */
  async completeStep(input: {
    tenantId: string;
    runId: string;
    stepId: string;
    output: Record<string, unknown>;
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const activeRun = await tx.workflowRun.updateMany({
        where: { id: input.runId, tenantId: input.tenantId, status: "running" },
        data: { status: "running" },
      });
      if (activeRun.count !== 1) return false;

      const updated = await tx.workflowStep.updateMany({
        where: {
          id: input.stepId,
          tenantId: input.tenantId,
          runId: input.runId,
          status: "running",
        },
        data: {
          status: "completed",
          output: input.output as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      if (updated.count !== 1) return false;
      await recordStepTransition(tx, {
        tenantId: input.tenantId,
        stepId: input.stepId,
        from: "running",
        to: "completed",
      });
      return true;
    });
  },

  /** 原子提交待审批步骤、审批点和运行状态，取消与暂停只会有一方成功。 */
  async waitForCheckpoint(input: CheckpointInput) {
    return prisma.$transaction(async (tx) => {
      const runUpdated = await tx.workflowRun.updateMany({
        where: { id: input.runId, tenantId: input.tenantId, status: "running" },
        data: { status: "waiting_for_human" },
      });
      if (runUpdated.count !== 1) return null;

      const stepUpdated = await tx.workflowStep.updateMany({
        where: {
          id: input.stepId,
          tenantId: input.tenantId,
          runId: input.runId,
          status: "running",
        },
        data: {
          status: "waiting_for_human",
          output: input.stepOutput as Prisma.InputJsonValue,
        },
      });
      if (stepUpdated.count !== 1) throw new Error(`步骤 ${input.stepKey} 无法进入待审批状态`);

      const checkpoint = await tx.humanCheckpoint.create({
        data: {
          tenantId: input.tenantId,
          workflowRunId: input.runId,
          type: input.checkpoint.type,
          status: "pending",
          title: input.checkpoint.title,
          summary: input.checkpoint.summary,
          entityType: input.checkpoint.entityType,
          entityId: input.checkpoint.entityId,
          payload: input.checkpoint.payload as Prisma.InputJsonValue,
          priority: input.checkpoint.priority,
          assigneeRole: input.checkpoint.assigneeRole,
          createdBy: input.checkpoint.createdBy,
        },
      });
      await recordStepTransition(tx, {
        tenantId: input.tenantId,
        stepId: input.stepId,
        from: "running",
        to: "waiting_for_human",
      });
      await recordStatusEvent(
        {
          tenantId: input.tenantId,
          entityType: WORKFLOW_RUN_STATUS.entityType,
          entityId: input.runId,
          fromValue: "running",
          toValue: "waiting_for_human",
          actorType: "system",
        },
        tx,
      );
      return checkpoint;
    });
  },

  async completeRun(input: {
    tenantId: string;
    runId: string;
    output: Record<string, unknown>;
  }): Promise<boolean> {
    return transitionRun({
      tenantId: input.tenantId,
      runId: input.runId,
      expected: ["running"],
      to: "completed",
      data: {
        output: input.output as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  },

  /** 最终失败回调只能终止仍在运行的 run，取消后的迟到失败会被丢弃。 */
  async failRun(input: {
    tenantId: string;
    runId: string;
    stepId: string | null;
    error: string;
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const runUpdated = await tx.workflowRun.updateMany({
        where: { id: input.runId, tenantId: input.tenantId, status: "running" },
        data: { status: "failed", failureReason: input.error, completedAt: new Date() },
      });
      if (runUpdated.count !== 1) return false;

      if (input.stepId) {
        const stepUpdated = await tx.workflowStep.updateMany({
          where: {
            id: input.stepId,
            tenantId: input.tenantId,
            runId: input.runId,
            status: { in: ["pending", "running"] },
          },
          data: { status: "failed", failureReason: input.error, completedAt: new Date() },
        });
        if (stepUpdated.count === 1) {
          await recordStepTransition(tx, {
            tenantId: input.tenantId,
            stepId: input.stepId,
            from: "running",
            to: "failed",
            reason: input.error,
          });
        }
      }
      await recordStatusEvent(
        {
          tenantId: input.tenantId,
          entityType: WORKFLOW_RUN_STATUS.entityType,
          entityId: input.runId,
          fromValue: "running",
          toValue: "failed",
          actorType: "system",
          reason: input.error,
        },
        tx,
      );
      return true;
    });
  },

  /**
   * 逻辑取消：终止 run、跳过未结束步骤、关闭待审批点并取消所属 Agent。
   * Provider 请求可能仍在网络层执行，但其迟到结果不能再改变工作流终态。
   */
  async cancelRun(ctx: TenantCtx, runId: string, reason = "用户取消工作流") {
    return prisma.$transaction(async (tx) => {
      const run = await tx.workflowRun.findFirst({
        where: { id: runId, tenantId: ctx.orgId },
        select: { status: true },
      });
      if (!run) return { kind: "not_found" as const };
      if (!ACTIVE_RUN_STATUSES.includes(run.status as (typeof ACTIVE_RUN_STATUSES)[number])) {
        return { kind: "terminal" as const, status: run.status };
      }

      assertTransition(WORKFLOW_RUN_STATUS, run.status, "cancelled");
      const runUpdated = await tx.workflowRun.updateMany({
        where: { id: runId, tenantId: ctx.orgId, status: run.status },
        data: { status: "cancelled", completedAt: new Date(), failureReason: reason },
      });
      if (runUpdated.count !== 1) return { kind: "conflict" as const };

      const activeSteps = await tx.workflowStep.findMany({
        where: {
          tenantId: ctx.orgId,
          runId,
          status: { in: [...ACTIVE_STEP_STATUSES] },
        },
        select: { id: true, status: true },
      });
      await tx.workflowStep.updateMany({
        where: {
          tenantId: ctx.orgId,
          runId,
          status: { in: [...ACTIVE_STEP_STATUSES] },
        },
        data: { status: "skipped", failureReason: reason, completedAt: new Date() },
      });
      await tx.agentRun.updateMany({
        where: { tenantId: ctx.orgId, workflowRunId: runId, status: "running" },
        data: { status: "cancelled", failureReason: reason, completedAt: new Date() },
      });
      await tx.humanCheckpoint.updateMany({
        where: { tenantId: ctx.orgId, workflowRunId: runId, status: "pending" },
        data: {
          status: "rejected",
          decidedBy: ctx.userId ?? null,
          decidedAt: new Date(),
          decisionReason: reason,
        },
      });

      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: WORKFLOW_RUN_STATUS.entityType,
          entityId: runId,
          fromValue: run.status,
          toValue: "cancelled",
          actorType: "user",
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
      for (const step of activeSteps) {
        await recordStepTransition(tx, {
          tenantId: ctx.orgId,
          stepId: step.id,
          from: step.status,
          to: "skipped",
          actorId: ctx.userId ?? null,
          reason,
        });
      }
      return { kind: "cancelled" as const };
    });
  },

  async findRetrySource(ctx: TenantCtx, runId: string) {
    return prisma.workflowRun.findFirst({
      where: { id: runId, tenantId: ctx.orgId },
      select: { workflowKey: true },
    });
  },

  /**
   * 为失败运行创建新的完整运行。旧运行保持 failed，唯一 retry_of_run_id 保证重复请求幂等。
   */
  async createRetryRun(input: {
    ctx: TenantCtx;
    runId: string;
    safeStepKeys: readonly string[];
    steps: readonly string[];
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const source = await tx.workflowRun.findFirst({
          where: { id: input.runId, tenantId: input.ctx.orgId },
          include: { retriedBy: true },
        });
        if (!source) return { kind: "not_found" as const };
        if (source.status !== "failed") return { kind: "not_failed" as const };
        if (source.retriedBy) {
          return { kind: "created" as const, run: source.retriedBy, reused: true };
        }

        const failedStep = await tx.workflowStep.findFirst({
          where: { tenantId: input.ctx.orgId, runId: input.runId, status: "failed" },
          orderBy: { stepOrder: "asc" },
          select: { stepKey: true },
        });
        if (!failedStep || !input.safeStepKeys.includes(failedStep.stepKey)) {
          return { kind: "unsafe_step" as const };
        }

        if (source.subjectType && source.subjectId) {
          const active = await tx.workflowRun.findFirst({
            where: {
              tenantId: input.ctx.orgId,
              workflowKey: source.workflowKey,
              subjectType: source.subjectType,
              subjectId: source.subjectId,
              status: { in: [...ACTIVE_RUN_STATUSES] },
            },
            select: { id: true },
          });
          if (active) return { kind: "active_conflict" as const };
        }

        const run = await tx.workflowRun.create({
          data: {
            tenantId: input.ctx.orgId,
            workflowKey: source.workflowKey,
            status: "queued",
            subjectType: source.subjectType,
            subjectId: source.subjectId,
            input: source.input as Prisma.InputJsonValue,
            retryOfRunId: source.id,
            createdBy: input.ctx.userId ?? null,
          },
        });
        await tx.workflowStep.createMany({
          data: input.steps.map((stepKey, stepOrder) => ({
            tenantId: input.ctx.orgId,
            runId: run.id,
            stepKey,
            stepOrder,
            status: "pending",
          })),
        });
        await recordStatusEvent(
          {
            tenantId: input.ctx.orgId,
            entityType: WORKFLOW_RUN_STATUS.entityType,
            entityId: run.id,
            fromValue: null,
            toValue: "queued",
            actorType: "user",
            actorId: input.ctx.userId ?? null,
            reason: "手动重试工作流",
            metadata: { retry_of_run_id: source.id, failed_step_key: failedStep.stepKey },
          },
          tx,
        );
        return { kind: "created" as const, run, reused: false };
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const existing = await prisma.workflowRun.findFirst({
          where: { tenantId: input.ctx.orgId, retryOfRunId: input.runId },
        });
        if (existing) return { kind: "created" as const, run: existing, reused: true };
      }
      throw error;
    }
  },

  /** 审批通过时原子恢复运行并完成等待步骤。 */
  async approveWaitingStep(input: {
    ctx: TenantCtx;
    runId: string;
    stepId: string;
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const runUpdated = await tx.workflowRun.updateMany({
        where: { id: input.runId, tenantId: input.ctx.orgId, status: "waiting_for_human" },
        data: { status: "running" },
      });
      if (runUpdated.count !== 1) return false;
      const stepUpdated = await tx.workflowStep.updateMany({
        where: {
          id: input.stepId,
          tenantId: input.ctx.orgId,
          runId: input.runId,
          status: "waiting_for_human",
        },
        data: { status: "completed", completedAt: new Date() },
      });
      if (stepUpdated.count !== 1) throw new Error("待审批步骤状态已变化");
      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: WORKFLOW_RUN_STATUS.entityType,
          entityId: input.runId,
          fromValue: "waiting_for_human",
          toValue: "running",
          actorType: "user",
          actorId: input.ctx.userId ?? null,
          reason: "人工审批通过",
        },
        tx,
      );
      await recordStepTransition(tx, {
        tenantId: input.ctx.orgId,
        stepId: input.stepId,
        from: "waiting_for_human",
        to: "completed",
        actorId: input.ctx.userId ?? null,
        reason: "人工审批通过",
      });
      return true;
    });
  },

  /** 审批驳回时原子终止等待中的运行和步骤。 */
  async rejectWaitingStep(input: {
    ctx: TenantCtx;
    runId: string;
    stepId: string;
    reason: string;
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const runUpdated = await tx.workflowRun.updateMany({
        where: { id: input.runId, tenantId: input.ctx.orgId, status: "waiting_for_human" },
        data: { status: "cancelled", failureReason: input.reason, completedAt: new Date() },
      });
      if (runUpdated.count !== 1) return false;
      const stepUpdated = await tx.workflowStep.updateMany({
        where: {
          id: input.stepId,
          tenantId: input.ctx.orgId,
          runId: input.runId,
          status: "waiting_for_human",
        },
        data: { status: "failed", failureReason: input.reason, completedAt: new Date() },
      });
      if (stepUpdated.count !== 1) throw new Error("待审批步骤状态已变化");
      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: WORKFLOW_RUN_STATUS.entityType,
          entityId: input.runId,
          fromValue: "waiting_for_human",
          toValue: "cancelled",
          actorType: "user",
          actorId: input.ctx.userId ?? null,
          reason: input.reason,
        },
        tx,
      );
      await recordStepTransition(tx, {
        tenantId: input.ctx.orgId,
        stepId: input.stepId,
        from: "waiting_for_human",
        to: "failed",
        actorId: input.ctx.userId ?? null,
        reason: input.reason,
      });
      return true;
    });
  },
};
