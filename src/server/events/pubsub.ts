import "server-only";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const globalForRedis = globalThis as unknown as {
  redisPub?: Redis;
  redisShared?: Redis;
};

/** 发布用连接（也可用于普通命令、BullMQ 之外的场景） */
export function getRedis(): Redis {
  globalForRedis.redisShared ??= new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return globalForRedis.redisShared;
}

export function workflowChannel(runId: string): string {
  return `wf:${runId}`;
}

export function agentChannel(runId: string): string {
  return `agent:${runId}`;
}

export interface WorkflowEvent {
  type: "run_status" | "step_status" | "heartbeat";
  run_id: string;
  status?: string;
  step_key?: string;
  step_status?: string;
  message?: string;
  at: string;
}

export interface AgentEvent {
  type: "run_status" | "call_status" | "heartbeat";
  run_id: string;
  status?: string;
  call_id?: string;
  phase?: string;
  attempt?: number;
  message?: string;
  at: string;
}

export async function publishWorkflowEvent(
  runId: string,
  event: Omit<WorkflowEvent, "run_id" | "at">,
): Promise<void> {
  const payload: WorkflowEvent = { ...event, run_id: runId, at: new Date().toISOString() };
  await getRedis().publish(workflowChannel(runId), JSON.stringify(payload));
}

/** 订阅工作流事件（SSE 端使用）；返回取消订阅函数 */
export async function subscribeWorkflow(
  runId: string,
  onEvent: (event: WorkflowEvent) => void,
): Promise<() => Promise<void>> {
  const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  await sub.subscribe(workflowChannel(runId));
  sub.on("message", (_channel, message) => {
    try {
      onEvent(JSON.parse(message) as WorkflowEvent);
    } catch {
      // 忽略坏消息
    }
  });
  return async () => {
    await sub.unsubscribe(workflowChannel(runId)).catch(() => {});
    sub.disconnect();
  };
}

export async function publishAgentEvent(
  runId: string,
  event: Omit<AgentEvent, "run_id" | "at">,
): Promise<void> {
  const payload: AgentEvent = { ...event, run_id: runId, at: new Date().toISOString() };
  try {
    await getRedis().publish(agentChannel(runId), JSON.stringify(payload));
  } catch (error) {
    // 监控事件不能阻断 Agent 主链路
    console.error("[agent-monitor] 实时事件发布失败", error);
  }
}

export async function subscribeAgent(
  runId: string,
  onEvent: (event: AgentEvent) => void,
): Promise<() => Promise<void>> {
  const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  await sub.subscribe(agentChannel(runId));
  sub.on("message", (_channel, message) => {
    try {
      onEvent(JSON.parse(message) as AgentEvent);
    } catch {
      // 忽略坏消息
    }
  });
  return async () => {
    await sub.unsubscribe(agentChannel(runId)).catch(() => {});
    sub.disconnect();
  };
}
