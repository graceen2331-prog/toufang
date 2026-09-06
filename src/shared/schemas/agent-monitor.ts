export interface AgentRunActorDto {
  id: string;
  name: string;
  email: string;
}

export interface AgentRunListItemDto {
  id: string;
  agent_key: string;
  status: string;
  mode: "workflow" | "sync";
  workflow_run_id: string | null;
  workflow_key: string | null;
  subject_type: string | null;
  subject_id: string | null;
  provider: string | null;
  model: string | null;
  call_count: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_microcents: number;
  failure_reason: string | null;
  error_type: string | null;
  anomalies: string[];
  actor: AgentRunActorDto | null;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface AgentCallDto {
  id: string;
  phase: string;
  attempt: number;
  status: string;
  provider: string;
  model: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  input_tokens: number;
  output_tokens: number;
  cost_microcents: number;
  latency_ms: number;
  error_type: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface AgentRunTimelineItemDto {
  id: string;
  type: "agent_started" | "call_started" | "call_completed" | "call_failed" | "agent_completed" | "agent_failed";
  title: string;
  description: string | null;
  status: string;
  at: string;
}

export interface AgentRunDetailDto extends AgentRunListItemDto {
  prompt_key: string | null;
  prompt_version: string | null;
  prompt: Record<string, unknown>;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  calls: AgentCallDto[];
  timeline: AgentRunTimelineItemDto[];
  workflow: {
    id: string;
    key: string;
    status: string;
    steps: Array<{
      id: string;
      key: string;
      order: number;
      status: string;
      attempt: number;
      started_at: string | null;
      completed_at: string | null;
      failure_reason: string | null;
    }>;
  } | null;
}

export interface AgentRunSensitiveDto {
  id: string;
  prompt: Record<string, unknown>;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  calls: Array<Pick<AgentCallDto, "id" | "request" | "response">>;
}

export interface AgentMonitorSummaryDto {
  window_hours: number;
  active_runs: number;
  total_runs: number;
  total_calls: number;
  completed_runs: number;
  failed_runs: number;
  stuck_runs: number;
  success_rate: number;
  failure_rate: number;
  p95_latency_ms: number;
  today_cost_microcents: number;
  today_input_tokens: number;
  today_output_tokens: number;
  month_spent_microcents: number;
  month_budget_cents: number;
  budget_usage_rate: number;
  trend: Array<{ bucket: string; total: number; failed: number }>;
}

export interface AgentInfrastructureDto {
  status: "healthy" | "degraded" | "unavailable";
  checked_at: string;
  queues: Array<{
    key: string;
    label: string;
    status: "healthy" | "degraded" | "offline";
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    workers: number;
    oldest_wait_ms: number | null;
  }>;
  message: string | null;
}

export const AGENT_KEY_LABELS: Record<string, string> = {
  strategy: "策略生成",
  research: "市场研究",
  creator_discovery: "达人发现",
  creator_scoring: "达人评分",
  brief: "Brief 生成",
  outreach: "外联起草",
  negotiation: "谈判分析",
  content_review: "内容审核",
  content_rewrite: "内容改写",
  analytics: "效果洞察",
  report: "报告生成",
  knowledge: "知识问答",
};

export const AGENT_CALL_PHASE_LABELS: Record<string, string> = {
  primary: "首次请求",
  repair: "结构修复",
};

export const AGENT_ERROR_LABELS: Record<string, string> = {
  budget: "预算超限",
  rate_limit: "Provider 限流",
  timeout: "请求超时",
  provider: "Provider 异常",
  validation: "输出校验失败",
  cancelled: "已取消",
  unknown: "未知异常",
};

export const AGENT_ANOMALY_LABELS: Record<string, string> = {
  failed: "运行失败",
  stuck: "疑似卡死",
  slow: "慢调用",
};
