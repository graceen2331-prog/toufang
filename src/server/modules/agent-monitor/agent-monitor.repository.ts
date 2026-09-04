import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface AgentRunListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  agentKey: string | null;
  provider: string | null;
  model: string | null;
  mode: "workflow" | "sync" | null;
  anomaly: "failed" | "stuck" | "slow" | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}

const callSelect = {
  id: true,
  phase: true,
  attempt: true,
  status: true,
  provider: true,
  model: true,
  requestPayload: true,
  responsePayload: true,
  inputTokens: true,
  outputTokens: true,
  costMicrocents: true,
  latencyMs: true,
  errorType: true,
  errorCode: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
} satisfies Prisma.AgentCallSelect;

export const agentRunListInclude = {
  workflowRun: {
    select: {
      id: true,
      workflowKey: true,
      subjectType: true,
      subjectId: true,
      status: true,
    },
  },
  calls: { orderBy: { createdAt: "desc" as const }, take: 1, select: callSelect },
  _count: { select: { calls: true } },
} satisfies Prisma.AgentRunInclude;

export const agentRunDetailInclude = {
  workflowRun: {
    select: {
      id: true,
      workflowKey: true,
      subjectType: true,
      subjectId: true,
      status: true,
      steps: {
        orderBy: { stepOrder: "asc" as const },
        select: {
          id: true,
          stepKey: true,
          stepOrder: true,
          status: true,
          attempt: true,
          startedAt: true,
          completedAt: true,
          failureReason: true,
        },
      },
    },
  },
  calls: { orderBy: { createdAt: "asc" as const }, select: callSelect },
} satisfies Prisma.AgentRunInclude;

export type AgentRunListRow = Prisma.AgentRunGetPayload<{ include: typeof agentRunListInclude }>;
export type AgentRunDetailRow = Prisma.AgentRunGetPayload<{ include: typeof agentRunDetailInclude }>;

export const agentMonitorRepository = {
  async createRun(input: {
    tenantId: string;
    workflowRunId: string | null;
    agentKey: string;
    subjectType: string | null;
    subjectId: string | null;
    input: Record<string, unknown>;
    promptSnapshot: Record<string, unknown>;
    promptKey: string;
    promptVersion: string;
    createdBy: string | null;
  }) {
    return prisma.agentRun.create({
      data: {
        tenantId: input.tenantId,
        workflowRunId: input.workflowRunId,
        agentKey: input.agentKey,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: "running",
        input: input.input as Prisma.InputJsonValue,
        promptSnapshot: input.promptSnapshot as Prisma.InputJsonValue,
        promptKey: input.promptKey,
        promptVersion: input.promptVersion,
        createdBy: input.createdBy,
      },
    });
  },

  async completeRun(tenantId: string, id: string, output: unknown, model: string | null) {
    const result = await prisma.agentRun.updateMany({
      where: { id, tenantId, status: "running" },
      data: {
        status: "completed",
        output: output as Prisma.InputJsonValue,
        model,
        lastActivityAt: new Date(),
        completedAt: new Date(),
      },
    });
    return result.count === 1;
  },

  async failRun(tenantId: string, id: string, failureReason: string) {
    const result = await prisma.agentRun.updateMany({
      where: { id, tenantId, status: "running" },
      data: {
        status: "failed",
        failureReason,
        lastActivityAt: new Date(),
        completedAt: new Date(),
      },
    });
    return result.count === 1;
  },

  async findLatestModel(tenantId: string, agentRunId: string): Promise<string | null> {
    const call = await prisma.agentCall.findFirst({
      where: { tenantId, agentRunId, status: "completed" },
      orderBy: { createdAt: "desc" },
      select: { model: true },
    });
    return call?.model ?? null;
  },

  async createCall(input: {
    tenantId: string;
    agentRunId: string;
    phase: "primary" | "repair";
    attempt: number;
    provider: string;
    model: string;
    requestPayload: Record<string, unknown>;
  }) {
    return prisma.$transaction(async (tx) => {
      const call = await tx.agentCall.create({
        data: {
          tenantId: input.tenantId,
          agentRunId: input.agentRunId,
          phase: input.phase,
          attempt: input.attempt,
          provider: input.provider,
          model: input.model,
          requestPayload: input.requestPayload as Prisma.InputJsonValue,
        },
      });
      await tx.agentRun.updateMany({
        where: { id: input.agentRunId, tenantId: input.tenantId },
        data: { lastActivityAt: new Date() },
      });
      return call;
    });
  },

  async completeCall(input: {
    tenantId: string;
    callId: string;
    model: string;
    responsePayload: Record<string, unknown>;
    inputTokens: number;
    outputTokens: number;
    costMicrocents: number;
    latencyMs: number;
  }) {
    await prisma.$transaction(async (tx) => {
      await tx.agentCall.updateMany({
        where: { id: input.callId, tenantId: input.tenantId },
        data: {
          status: "completed",
          model: input.model,
          responsePayload: input.responsePayload as Prisma.InputJsonValue,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costMicrocents: input.costMicrocents,
          latencyMs: input.latencyMs,
          completedAt: new Date(),
        },
      });
      const call = await tx.agentCall.findFirst({
        where: { id: input.callId, tenantId: input.tenantId },
        select: { agentRunId: true },
      });
      if (call) {
        await tx.agentRun.updateMany({
          where: { id: call.agentRunId, tenantId: input.tenantId },
          data: { lastActivityAt: new Date() },
        });
      }
    });
  },

  async failCall(input: {
    tenantId: string;
    callId: string;
    latencyMs: number;
    errorType: string;
    errorCode: string | null;
    errorMessage: string;
  }) {
    await prisma.agentCall.updateMany({
      where: { id: input.callId, tenantId: input.tenantId },
      data: {
        status: "failed",
        latencyMs: input.latencyMs,
        errorType: input.errorType,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        completedAt: new Date(),
      },
    });
  },

  async listRuns(ctx: TenantCtx, params: AgentRunListParams): Promise<AgentRunListRow[]> {
    const now = Date.now();
    const where: Prisma.AgentRunWhereInput = {
      tenantId: ctx.orgId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.agentKey ? { agentKey: params.agentKey } : {}),
      ...(params.provider ? { calls: { some: { provider: params.provider } } } : {}),
      ...(params.model ? { calls: { some: { model: params.model } } } : {}),
      ...(params.mode === "workflow"
        ? { workflowRunId: { not: null } }
        : params.mode === "sync"
          ? { workflowRunId: null }
          : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            createdAt: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
      ...(params.anomaly === "failed"
        ? { status: "failed" }
        : params.anomaly === "stuck"
          ? { status: "running", lastActivityAt: { lt: new Date(now - 5 * 60_000) } }
          : params.anomaly === "slow"
            ? { calls: { some: { latencyMs: { gte: 30_000 } } } }
            : {}),
      ...(params.cursor
        ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
        : {}),
    };
    return prisma.agentRun.findMany({
      where,
      orderBy: { id: params.order },
      take: params.limit + 1,
      include: agentRunListInclude,
    });
  },

  async aggregateCalls(ctx: TenantCtx, agentRunIds: string[]) {
    if (agentRunIds.length === 0) return [];
    return prisma.agentCall.groupBy({
      by: ["agentRunId"],
      where: { tenantId: ctx.orgId, agentRunId: { in: agentRunIds } },
      _sum: { inputTokens: true, outputTokens: true, costMicrocents: true, latencyMs: true },
      _max: { latencyMs: true },
      _count: true,
    });
  },

  async aggregateLegacyUsage(ctx: TenantCtx, agentRunIds: string[]) {
    if (agentRunIds.length === 0) return [];
    return prisma.aiUsageEvent.groupBy({
      by: ["agentRunId"],
      where: { tenantId: ctx.orgId, agentRunId: { in: agentRunIds } },
      _sum: { inputTokens: true, outputTokens: true, costMicrocents: true },
      _count: true,
    });
  },

  async findRun(ctx: TenantCtx, id: string): Promise<AgentRunDetailRow | null> {
    return prisma.agentRun.findFirst({
      where: { id, tenantId: ctx.orgId },
      include: agentRunDetailInclude,
    });
  },

  async findCreatorNames(ctx: TenantCtx, userIds: string[]) {
    if (userIds.length === 0) return [];
    return prisma.user.findMany({
      where: {
        id: { in: userIds },
        memberships: { some: { tenantId: ctx.orgId, status: "active", deletedAt: null } },
      },
      select: { id: true, name: true, email: true },
    });
  },

  async getRunStatus(ctx: TenantCtx, id: string) {
    return prisma.agentRun.findFirst({
      where: { id, tenantId: ctx.orgId },
      select: { id: true, status: true },
    });
  },

  async getSummary(ctx: TenantCtx, since: Date, todayStart: Date, monthStart: Date) {
    const [runs, completedCalls, callCount, todayUsage, monthUsage] = await Promise.all([
      prisma.agentRun.groupBy({
        by: ["status"],
        where: { tenantId: ctx.orgId, createdAt: { gte: since } },
        _count: true,
      }),
      prisma.agentCall.findMany({
        where: { tenantId: ctx.orgId, status: "completed", createdAt: { gte: since } },
        select: { latencyMs: true },
        orderBy: { latencyMs: "asc" },
        take: 50_000,
      }),
      prisma.agentCall.count({
        where: { tenantId: ctx.orgId, createdAt: { gte: since } },
      }),
      prisma.aiUsageEvent.aggregate({
        where: { tenantId: ctx.orgId, createdAt: { gte: todayStart } },
        _sum: { costMicrocents: true, inputTokens: true, outputTokens: true },
      }),
      prisma.aiUsageEvent.aggregate({
        where: { tenantId: ctx.orgId, createdAt: { gte: monthStart } },
        _sum: { costMicrocents: true },
      }),
    ]);
    return { runs, completedCalls, callCount, todayUsage, monthUsage };
  },

  async getHourlyTrend(ctx: TenantCtx, since: Date) {
    return prisma.agentRun.findMany({
      where: { tenantId: ctx.orgId, createdAt: { gte: since } },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    });
  },

  async getMonthlyBudgetCents(ctx: TenantCtx): Promise<number> {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { aiMonthlyBudgetCents: true },
    });
    return org?.aiMonthlyBudgetCents ?? 0;
  },
};
