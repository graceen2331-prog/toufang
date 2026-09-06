import "server-only";
import { prisma } from "@/server/db/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface WorkflowRunListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  workflowKey: string | null;
}

export const workflowRepository = {
  /** 运行列表（含步骤/Agent 计数），take limit+1 交由上层 paginate */
  async listRuns(ctx: TenantCtx, params: WorkflowRunListParams) {
    return prisma.workflowRun.findMany({
      where: {
        tenantId: ctx.orgId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.workflowKey ? { workflowKey: params.workflowKey } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
      include: { _count: { select: { steps: true, agentRuns: true } } },
    });
  },

  /** 单个运行详情（步骤 + Agent 运行 + 最近审批点） */
  async findRunWithRelations(ctx: TenantCtx, id: string) {
    return prisma.workflowRun.findFirst({
      where: { id, tenantId: ctx.orgId },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        agentRuns: { orderBy: { createdAt: "asc" } },
        checkpoints: { orderBy: { createdAt: "desc" }, take: 5 },
        retryOf: { select: { id: true } },
        retriedBy: { select: { id: true } },
      },
    });
  },

  async findRunStatus(ctx: TenantCtx, id: string) {
    return prisma.workflowRun.findFirst({
      where: { id, tenantId: ctx.orgId },
      select: { id: true, status: true, createdAt: true, startedAt: true },
    });
  },

  /** 汇总一组 Agent 运行的用量 */
  async aggregateUsageForAgentRuns(ctx: TenantCtx, agentRunIds: string[]) {
    return prisma.aiUsageEvent.aggregate({
      where: { tenantId: ctx.orgId, agentRunId: { in: agentRunIds } },
      _sum: { costMicrocents: true, inputTokens: true, outputTokens: true },
    });
  },

  /** 组织的 AI 月度预算（分） */
  async getMonthlyBudgetCents(ctx: TenantCtx): Promise<number> {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { aiMonthlyBudgetCents: true },
    });
    return org?.aiMonthlyBudgetCents ?? 0;
  },

  /** 指定时间后的用量按 Agent 分组汇总 */
  async groupUsageByAgent(ctx: TenantCtx, since: Date) {
    return prisma.aiUsageEvent.groupBy({
      by: ["agentKey"],
      where: { tenantId: ctx.orgId, createdAt: { gte: since } },
      _sum: { costMicrocents: true, inputTokens: true, outputTokens: true },
      _count: true,
    });
  },
};
