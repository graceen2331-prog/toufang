import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { getQueueInfrastructureHealth } from "@/server/jobs/health";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import {
  agentMonitorRepository,
  type AgentRunDetailRow,
  type AgentRunListParams,
  type AgentRunListRow,
} from "./agent-monitor.repository";
import { classifyAgentError, redactSensitive } from "./agent-monitor.utils";
import type {
  AgentCallDto,
  AgentInfrastructureDto,
  AgentMonitorSummaryDto,
  AgentRunActorDto,
  AgentRunDetailDto,
  AgentRunListItemDto,
  AgentRunSensitiveDto,
  AgentRunTimelineItemDto,
} from "@/shared/schemas/agent-monitor";

const STUCK_AFTER_MS = 5 * 60_000;
const SLOW_CALL_MS = 30_000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function durationMs(startedAt: Date, completedAt: Date | null): number {
  return Math.max(0, (completedAt ?? new Date()).getTime() - startedAt.getTime());
}

function anomaliesFor(run: {
  status: string;
  lastActivityAt: Date;
  calls: Array<{ latencyMs: number }>;
}, maxLatencyMs = 0): string[] {
  const anomalies: string[] = [];
  if (run.status === "failed") anomalies.push("failed");
  if (run.status === "running" && Date.now() - run.lastActivityAt.getTime() >= STUCK_AFTER_MS) {
    anomalies.push("stuck");
  }
  if (maxLatencyMs >= SLOW_CALL_MS || run.calls.some((call) => call.latencyMs >= SLOW_CALL_MS)) {
    anomalies.push("slow");
  }
  return anomalies;
}

function toCallDto(call: AgentRunDetailRow["calls"][number], sensitive = false): AgentCallDto {
  const request = asRecord(call.requestPayload);
  const response = asRecord(call.responsePayload);
  return {
    id: call.id,
    phase: call.phase,
    attempt: call.attempt,
    status: call.status,
    provider: call.provider,
    model: call.model,
    request: (sensitive ? request : redactSensitive(request)) as Record<string, unknown>,
    response: (sensitive ? response : redactSensitive(response)) as Record<string, unknown>,
    input_tokens: call.inputTokens,
    output_tokens: call.outputTokens,
    cost_microcents: call.costMicrocents,
    latency_ms: call.latencyMs,
    error_type: call.errorType,
    error_code: call.errorCode,
    error_message: call.errorMessage,
    started_at: call.startedAt.toISOString(),
    completed_at: call.completedAt?.toISOString() ?? null,
  };
}

function subjectFor(run: AgentRunListRow | AgentRunDetailRow) {
  return {
    type: run.subjectType ?? run.workflowRun?.subjectType ?? null,
    id: run.subjectId ?? run.workflowRun?.subjectId ?? null,
  };
}

function actorFor(
  createdBy: string | null,
  actorMap: Map<string, AgentRunActorDto>,
): AgentRunActorDto | null {
  return createdBy ? (actorMap.get(createdBy) ?? null) : null;
}

function baseDto(
  run: AgentRunListRow | AgentRunDetailRow,
  aggregate: {
    inputTokens: number;
    outputTokens: number;
    costMicrocents: number;
    callCount: number;
    maxLatencyMs: number;
  },
  actor: AgentRunActorDto | null,
): AgentRunListItemDto {
  const subject = subjectFor(run);
  const latestCall = run.calls[run.calls.length - 1] ?? null;
  const classified = run.failureReason ? classifyAgentError(new Error(run.failureReason)) : null;
  return {
    id: run.id,
    agent_key: run.agentKey,
    status: run.status,
    mode: run.workflowRunId ? "workflow" : "sync",
    workflow_run_id: run.workflowRunId,
    workflow_key: run.workflowRun?.workflowKey ?? null,
    subject_type: subject.type,
    subject_id: subject.id,
    provider: latestCall?.provider ?? null,
    model: run.model ?? latestCall?.model ?? null,
    call_count: aggregate.callCount,
    duration_ms: durationMs(run.startedAt, run.completedAt),
    input_tokens: aggregate.inputTokens,
    output_tokens: aggregate.outputTokens,
    cost_microcents: aggregate.costMicrocents,
    failure_reason: run.failureReason,
    error_type: classified?.type ?? latestCall?.errorType ?? null,
    anomalies: anomaliesFor(run, aggregate.maxLatencyMs),
    actor,
    started_at: run.startedAt.toISOString(),
    last_activity_at: run.lastActivityAt.toISOString(),
    completed_at: run.completedAt?.toISOString() ?? null,
    created_at: run.createdAt.toISOString(),
  };
}

export function parseAgentMonitorDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  if (Number.isNaN(date.getTime())) throw new ApiError("VALIDATION_FAILED", "日期格式无效");
  return date;
}

export async function listAgentRuns(
  ctx: TenantCtx,
  params: AgentRunListParams,
): Promise<{ items: AgentRunListItemDto[]; pagination: Pagination }> {
  const rows = await agentMonitorRepository.listRuns(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  const ids = items.map((run) => run.id);
  const userIds = [...new Set(items.map((run) => run.createdBy).filter((id): id is string => !!id))];
  const [aggregates, legacyUsage, actors] = await Promise.all([
    agentMonitorRepository.aggregateCalls(ctx, ids),
    agentMonitorRepository.aggregateLegacyUsage(ctx, ids),
    agentMonitorRepository.findCreatorNames(ctx, userIds),
  ]);
  const legacyMap = new Map(legacyUsage.map((row) => [row.agentRunId, row]));
  const aggregateMap = new Map(
    aggregates.map((row) => [
      row.agentRunId,
      {
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        costMicrocents: row._sum.costMicrocents ?? 0,
        callCount: row._count,
        maxLatencyMs: row._max.latencyMs ?? 0,
      },
    ]),
  );
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
  return {
    items: items.map((run) =>
      {
        const calls = aggregateMap.get(run.id);
        const legacy = legacyMap.get(run.id);
        return baseDto(
          run,
          calls ?? {
            inputTokens: legacy?._sum.inputTokens ?? 0,
            outputTokens: legacy?._sum.outputTokens ?? 0,
            costMicrocents: legacy?._sum.costMicrocents ?? 0,
            callCount: legacy?._count ?? run._count.calls,
            maxLatencyMs: 0,
          },
          actorFor(run.createdBy, actorMap),
        );
      },
    ),
    pagination,
  };
}

function buildTimeline(run: AgentRunDetailRow): AgentRunTimelineItemDto[] {
  const items: AgentRunTimelineItemDto[] = [
    {
      id: `${run.id}-started`,
      type: "agent_started",
      title: "Agent 开始运行",
      description: run.promptKey ? `${run.promptKey}@${run.promptVersion ?? "?"}` : null,
      status: "running",
      at: run.startedAt.toISOString(),
    },
  ];
  for (const call of run.calls) {
    items.push({
      id: `${call.id}-started`,
      type: "call_started",
      title: `${call.phase === "repair" ? "结构修复" : "模型请求"} · 第 ${call.attempt} 次尝试`,
      description: `${call.provider} / ${call.model}`,
      status: "running",
      at: call.startedAt.toISOString(),
    });
    if (call.completedAt) {
      items.push({
        id: `${call.id}-finished`,
        type: call.status === "failed" ? "call_failed" : "call_completed",
        title: call.status === "failed" ? "模型调用失败" : "模型调用完成",
        description: call.errorMessage ?? `${call.latencyMs}ms`,
        status: call.status,
        at: call.completedAt.toISOString(),
      });
    }
  }
  if (run.completedAt) {
    items.push({
      id: `${run.id}-finished`,
      type: run.status === "failed" ? "agent_failed" : "agent_completed",
      title: run.status === "failed" ? "Agent 运行失败" : "Agent 运行完成",
      description: run.failureReason,
      status: run.status,
      at: run.completedAt.toISOString(),
    });
  }
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export async function getAgentRun(ctx: TenantCtx, id: string): Promise<AgentRunDetailDto> {
  const run = await agentMonitorRepository.findRun(ctx, id);
  if (!run) throw new ApiError("RESOURCE_NOT_FOUND", "Agent 运行不存在");
  const actors = run.createdBy ? await agentMonitorRepository.findCreatorNames(ctx, [run.createdBy]) : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
  const aggregate = run.calls.reduce(
    (sum, call) => ({
      inputTokens: sum.inputTokens + call.inputTokens,
      outputTokens: sum.outputTokens + call.outputTokens,
      costMicrocents: sum.costMicrocents + call.costMicrocents,
      callCount: sum.callCount + 1,
      maxLatencyMs: Math.max(sum.maxLatencyMs, call.latencyMs),
    }),
    { inputTokens: 0, outputTokens: 0, costMicrocents: 0, callCount: 0, maxLatencyMs: 0 },
  );
  if (aggregate.callCount === 0) {
    const [legacy] = await agentMonitorRepository.aggregateLegacyUsage(ctx, [run.id]);
    if (legacy) {
      aggregate.inputTokens = legacy._sum.inputTokens ?? 0;
      aggregate.outputTokens = legacy._sum.outputTokens ?? 0;
      aggregate.costMicrocents = legacy._sum.costMicrocents ?? 0;
      aggregate.callCount = legacy._count;
    }
  }
  return {
    ...baseDto(run, aggregate, actorFor(run.createdBy, actorMap)),
    prompt_key: run.promptKey,
    prompt_version: run.promptVersion,
    prompt: redactSensitive(asRecord(run.promptSnapshot)) as Record<string, unknown>,
    input: redactSensitive(asRecord(run.input)) as Record<string, unknown>,
    output: redactSensitive(asRecord(run.output)) as Record<string, unknown>,
    calls: run.calls.map((call) => toCallDto(call)),
    timeline: buildTimeline(run),
    workflow: run.workflowRun
      ? {
          id: run.workflowRun.id,
          key: run.workflowRun.workflowKey,
          status: run.workflowRun.status,
          steps: run.workflowRun.steps.map((step) => ({
            id: step.id,
            key: step.stepKey,
            order: step.stepOrder,
            status: step.status,
            attempt: step.attempt,
            started_at: step.startedAt?.toISOString() ?? null,
            completed_at: step.completedAt?.toISOString() ?? null,
            failure_reason: step.failureReason,
          })),
        }
      : null,
  };
}

export async function getAgentRunSensitive(
  ctx: TenantCtx,
  id: string,
): Promise<AgentRunSensitiveDto> {
  const run = await agentMonitorRepository.findRun(ctx, id);
  if (!run) throw new ApiError("RESOURCE_NOT_FOUND", "Agent 运行不存在");
  return {
    id: run.id,
    prompt: asRecord(run.promptSnapshot),
    input: asRecord(run.input),
    output: asRecord(run.output),
    calls: run.calls.map((call) => {
      const dto = toCallDto(call, true);
      return { id: dto.id, request: dto.request, response: dto.response };
    }),
  };
}

export async function getAgentRunStatus(ctx: TenantCtx, id: string) {
  const run = await agentMonitorRepository.getRunStatus(ctx, id);
  if (!run) throw new ApiError("RESOURCE_NOT_FOUND", "Agent 运行不存在");
  return run;
}

export async function getAgentMonitorSummary(ctx: TenantCtx): Promise<AgentMonitorSummaryDto> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [summary, trendRows, budgetCents] = await Promise.all([
    agentMonitorRepository.getSummary(ctx, since, todayStart, monthStart),
    agentMonitorRepository.getHourlyTrend(ctx, since),
    agentMonitorRepository.getMonthlyBudgetCents(ctx),
  ]);
  const counts = new Map(summary.runs.map((row) => [row.status, row._count]));
  const completed = counts.get("completed") ?? 0;
  const failed = counts.get("failed") ?? 0;
  const active = counts.get("running") ?? 0;
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const terminal = completed + failed;
  const latencies = summary.completedCalls.map((call) => call.latencyMs);
  const p95Index = latencies.length === 0 ? -1 : Math.ceil(latencies.length * 0.95) - 1;

  const trendMap = new Map<string, { total: number; failed: number }>();
  for (let index = 23; index >= 0; index--) {
    const bucket = new Date(now.getTime() - index * 60 * 60_000);
    bucket.setMinutes(0, 0, 0);
    trendMap.set(bucket.toISOString(), { total: 0, failed: 0 });
  }
  for (const row of trendRows) {
    const bucket = new Date(row.createdAt);
    bucket.setMinutes(0, 0, 0);
    const value = trendMap.get(bucket.toISOString());
    if (!value) continue;
    value.total += 1;
    if (row.status === "failed") value.failed += 1;
  }
  const stuckRuns = await agentMonitorRepository.listRuns(ctx, {
    limit: 100,
    cursor: null,
    order: "desc",
    status: null,
    agentKey: null,
    provider: null,
    model: null,
    mode: null,
    anomaly: "stuck",
    dateFrom: null,
    dateTo: null,
  });
  const monthSpent = summary.monthUsage._sum.costMicrocents ?? 0;
  const budgetMicrocents = budgetCents * 1_000_000;
  return {
    window_hours: 24,
    active_runs: active,
    total_runs: total,
    total_calls: summary.callCount,
    completed_runs: completed,
    failed_runs: failed,
    stuck_runs: Math.min(stuckRuns.length, 100),
    success_rate: terminal === 0 ? 1 : completed / terminal,
    failure_rate: terminal === 0 ? 0 : failed / terminal,
    p95_latency_ms: p95Index >= 0 ? (latencies[p95Index] ?? 0) : 0,
    today_cost_microcents: summary.todayUsage._sum.costMicrocents ?? 0,
    today_input_tokens: summary.todayUsage._sum.inputTokens ?? 0,
    today_output_tokens: summary.todayUsage._sum.outputTokens ?? 0,
    month_spent_microcents: monthSpent,
    month_budget_cents: budgetCents,
    budget_usage_rate: budgetMicrocents > 0 ? monthSpent / budgetMicrocents : 0,
    trend: [...trendMap.entries()].map(([bucket, value]) => ({ bucket, ...value })),
  };
}

export async function getAgentInfrastructure(): Promise<AgentInfrastructureDto> {
  return getQueueInfrastructureHealth();
}
