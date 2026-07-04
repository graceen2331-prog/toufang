// 工作流 / AI 监控 DTO（前后端共用）

export interface WorkflowRunListItemDto {
  id: string;
  workflow_key: string;
  status: string;
  subject_type: string | null;
  subject_id: string | null;
  step_count: number;
  agent_run_count: number;
  failure_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowStepDto {
  id: string;
  step_key: string;
  step_order: number;
  status: string;
  attempt: number;
  output: Record<string, unknown>;
  failure_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentRunDto {
  id: string;
  agent_key: string;
  status: string;
  prompt_key: string | null;
  prompt_version: string | null;
  model: string | null;
  failure_reason: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface WorkflowRunDetailDto {
  id: string;
  workflow_key: string;
  status: string;
  subject_type: string | null;
  subject_id: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  failure_reason: string | null;
  steps: WorkflowStepDto[];
  agent_runs: AgentRunDto[];
  pending_checkpoint_id: string | null;
  cost_microcents: number;
  input_tokens: number;
  output_tokens: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AiUsageSummaryDto {
  month_budget_cents: number;
  month_spent_microcents: number;
  by_agent: Array<{
    agent_key: string;
    calls: number;
    cost_microcents: number;
    input_tokens: number;
    output_tokens: number;
  }>;
}

export interface StrategyVersionDto {
  id: string;
  version: number;
  status: string;
  summary: string | null;
  content: Record<string, unknown>;
  model: string | null;
  prompt_key: string | null;
  prompt_version: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface StartWorkflowResponseDto {
  workflow_run_id: string;
  poll_url: string;
  events_url: string;
}

export const WORKFLOW_KEY_LABELS: Record<string, string> = {
  strategy: "策略生成",
  research: "市场研究",
  creator_discovery: "达人发现",
  creator_scoring: "达人评分",
  outreach: "外联触达",
  negotiation: "谈判分析",
  content_review: "内容审核",
  analytics: "效果分析",
  knowledge_learning: "知识沉淀",
};

export const STEP_KEY_LABELS: Record<string, string> = {
  gather_context: "汇集上下文",
  generate_strategy: "生成策略草案",
  apply_strategy: "落地策略版本",
  generate_research: "生成研究报告",
  save_research: "保存研究成果",
  search_candidates: "库内候选检索",
  match_creators: "AI 匹配评估",
  apply_candidates: "写入候选池",
  collect_candidates: "收集待评分候选",
  score_creators: "AI 六维评分",
  apply_scores: "落分与状态推进",
  generate_brief: "生成 Brief 草案",
  apply_brief: "创建 Brief 版本",
};

/** 成本显示：microcents(美分百万分之一) → 美元字符串 */
export function formatCost(microcents: number): string {
  return `$${(microcents / 100_000_000).toFixed(4)}`;
}
