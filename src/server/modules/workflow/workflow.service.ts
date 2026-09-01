import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { monthlyAiSpend } from "@/server/ai/router";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { workflowRepository } from "@/server/modules/workflow/workflow.repository";
import { getWorkflowDefinition } from "@/server/workflows/engine";
import type {
  AgentRunDto,
  AiUsageSummaryDto,
  WorkflowRunDetailDto,
  WorkflowRunListItemDto,
  WorkflowStepDto,
} from "@/shared/schemas/workflow";

export async function listWorkflowRuns(
  ctx: TenantCtx,
  params: { limit: number; cursor: string | null; order: "asc" | "desc"; status: string | null; workflowKey: string | null },
): Promise<{ items: WorkflowRunListItemDto[]; pagination: Pagination }> {
  const rows = await workflowRepository.listRuns(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return {
    items: items.map((run) => ({
      id: run.id,
      workflow_key: run.workflowKey,
      status: run.status,
      subject_type: run.subjectType,
      subject_id: run.subjectId,
      step_count: run._count.steps,
      agent_run_count: run._count.agentRuns,
      failure_reason: run.failureReason,
      started_at: run.startedAt?.toISOString() ?? null,
      completed_at: run.completedAt?.toISOString() ?? null,
      created_at: run.createdAt.toISOString(),
    })),
    pagination,
  };
}

export async function getWorkflowRun(ctx: TenantCtx, id: string): Promise<WorkflowRunDetailDto> {
  const run = await workflowRepository.findRunWithRelations(ctx, id);
  if (!run) throw new ApiError("RESOURCE_NOT_FOUND", "工作流不存在");

  const usage = await workflowRepository.aggregateUsageForAgentRuns(
    ctx,
    run.agentRuns.map((a) => a.id),
  );

  const steps: WorkflowStepDto[] = run.steps.map((s) => ({
    id: s.id,
    step_key: s.stepKey,
    step_order: s.stepOrder,
    status: s.status,
    attempt: s.attempt,
    output: (s.output as Record<string, unknown>) ?? {},
    failure_reason: s.failureReason,
    started_at: s.startedAt?.toISOString() ?? null,
    completed_at: s.completedAt?.toISOString() ?? null,
  }));

  const agentRuns: AgentRunDto[] = run.agentRuns.map((a) => ({
    id: a.id,
    agent_key: a.agentKey,
    status: a.status,
    prompt_key: a.promptKey,
    prompt_version: a.promptVersion,
    model: a.model,
    failure_reason: a.failureReason,
    started_at: a.startedAt.toISOString(),
    completed_at: a.completedAt?.toISOString() ?? null,
  }));
  const failedStep = run.steps.find((step) => step.status === "failed");
  const retrySafe = failedStep
    ? (getWorkflowDefinition(run.workflowKey).manualRetrySafeStepKeys ?? []).includes(
        failedStep.stepKey,
      )
    : false;
  const canRetry = run.status === "failed" && retrySafe && !run.retriedBy;
  const retryBlockedReason =
    run.status !== "failed"
      ? null
      : run.retriedBy
        ? "该运行已创建重试任务"
        : !retrySafe
          ? "失败发生在可能产生业务影响的步骤，请从对应业务页面重新发起"
          : null;

  return {
    id: run.id,
    workflow_key: run.workflowKey,
    status: run.status,
    subject_type: run.subjectType,
    subject_id: run.subjectId,
    input: (run.input as Record<string, unknown>) ?? {},
    output: (run.output as Record<string, unknown>) ?? {},
    failure_reason: run.failureReason,
    can_retry: canRetry,
    retry_blocked_reason: retryBlockedReason,
    retry_of_run_id: run.retryOf?.id ?? null,
    retried_by_run_id: run.retriedBy?.id ?? null,
    steps,
    agent_runs: agentRuns,
    pending_checkpoint_id:
      run.checkpoints.find((c) => c.status === "pending")?.id ?? null,
    cost_microcents: usage._sum.costMicrocents ?? 0,
    input_tokens: usage._sum.inputTokens ?? 0,
    output_tokens: usage._sum.outputTokens ?? 0,
    started_at: run.startedAt?.toISOString() ?? null,
    completed_at: run.completedAt?.toISOString() ?? null,
    created_at: run.createdAt.toISOString(),
  };
}

export async function getAiUsageSummary(ctx: TenantCtx): Promise<AiUsageSummaryDto> {
  const budgetCents = await workflowRepository.getMonthlyBudgetCents(ctx);
  const spent = await monthlyAiSpend(ctx.orgId);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const byAgent = await workflowRepository.groupUsageByAgent(ctx, monthStart);

  return {
    month_budget_cents: budgetCents,
    month_spent_microcents: spent,
    by_agent: byAgent.map((row) => ({
      agent_key: row.agentKey ?? "（未标注）",
      calls: row._count,
      cost_microcents: row._sum.costMicrocents ?? 0,
      input_tokens: row._sum.inputTokens ?? 0,
      output_tokens: row._sum.outputTokens ?? 0,
    })),
  };
}
