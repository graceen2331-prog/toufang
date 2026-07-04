// 状态机单一事实源：所有实体状态、中文标签、展示色调、合法转移
// 服务端在状态变更时用 assertTransition 校验；前端 StatusTag 用 label/tone 渲染

export type StatusTone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

export interface StateMachine {
  /** status_events.entity_type */
  entityType: string;
  field: string;
  initial: string;
  states: Record<string, StatusMeta>;
  /** 显式合法转移表；键为 from，值为可到达的 to 列表 */
  transitions: Record<string, string[]>;
}

// ---------------------------------------------------------------
// Campaign（17 态，线性主流程 + 取消/归档）
// ---------------------------------------------------------------

export const CAMPAIGN_PIPELINE = [
  "draft",
  "strategy",
  "research",
  "creator_discovery",
  "shortlisting",
  "brief_creation",
  "outreach",
  "negotiation",
  "contracting",
  "content_creation",
  "content_review",
  "publishing",
  "metrics_collection",
  "reporting",
  "completed",
] as const;

function pipelineTransitions(
  pipeline: readonly string[],
  opts: { cancel?: string; archive?: string; terminal?: string[] } = {},
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const terminals = new Set([opts.cancel, opts.archive, ...(opts.terminal ?? [])].filter(Boolean));
  pipeline.forEach((state, i) => {
    const targets: string[] = [];
    // 允许向前跳到任意后续阶段（阶段可按 Campaign 实际情况跳过）
    for (let j = i + 1; j < pipeline.length; j++) targets.push(pipeline[j]!);
    // 允许回退一步（纠错）
    if (i > 0) targets.push(pipeline[i - 1]!);
    if (opts.cancel && !terminals.has(state)) targets.push(opts.cancel);
    result[state] = targets;
  });
  const last = pipeline[pipeline.length - 1]!;
  result[last] = opts.archive ? [opts.archive] : [];
  if (opts.cancel) result[opts.cancel] = opts.archive ? [opts.archive] : [];
  if (opts.archive) result[opts.archive] = [];
  return result;
}

export const CAMPAIGN_STATUS: StateMachine = {
  entityType: "campaign",
  field: "status",
  initial: "draft",
  states: {
    draft: { label: "草稿", tone: "neutral" },
    strategy: { label: "策略制定", tone: "progress" },
    research: { label: "市场研究", tone: "progress" },
    creator_discovery: { label: "达人发现", tone: "progress" },
    shortlisting: { label: "候选评估", tone: "progress" },
    brief_creation: { label: "Brief 制作", tone: "progress" },
    outreach: { label: "达人触达", tone: "progress" },
    negotiation: { label: "谈判中", tone: "progress" },
    contracting: { label: "签约中", tone: "progress" },
    content_creation: { label: "内容创作", tone: "progress" },
    content_review: { label: "内容审核", tone: "progress" },
    publishing: { label: "发布中", tone: "progress" },
    metrics_collection: { label: "数据收集", tone: "progress" },
    reporting: { label: "复盘报告", tone: "progress" },
    completed: { label: "已完成", tone: "success" },
    cancelled: { label: "已取消", tone: "danger" },
    archived: { label: "已归档", tone: "neutral" },
  },
  transitions: pipelineTransitions(CAMPAIGN_PIPELINE, { cancel: "cancelled", archive: "archived" }),
};

export const CAMPAIGN_HEALTH: Record<string, StatusMeta> = {
  on_track: { label: "正常", tone: "success" },
  at_risk: { label: "有风险", tone: "warning" },
  blocked: { label: "受阻", tone: "danger" },
  completed: { label: "已完成", tone: "neutral" },
};

// ---------------------------------------------------------------
// CampaignCreator（16 态）
// ---------------------------------------------------------------

export const CAMPAIGN_CREATOR_STATUS: StateMachine = {
  entityType: "campaign_creator",
  field: "status",
  initial: "candidate",
  states: {
    candidate: { label: "候选", tone: "neutral" },
    scored: { label: "已评分", tone: "info" },
    shortlisted: { label: "已入围", tone: "info" },
    approved: { label: "已批准", tone: "success" },
    contacted: { label: "已触达", tone: "progress" },
    replied: { label: "已回复", tone: "progress" },
    negotiating: { label: "谈判中", tone: "progress" },
    confirmed: { label: "已确认合作", tone: "success" },
    contracting: { label: "签约中", tone: "progress" },
    active: { label: "执行中", tone: "progress" },
    content_submitted: { label: "内容已提交", tone: "info" },
    published: { label: "已发布", tone: "success" },
    completed: { label: "已完成", tone: "success" },
    rejected: { label: "已淘汰", tone: "danger" },
    no_response: { label: "无回应", tone: "warning" },
    cancelled: { label: "已取消", tone: "danger" },
  },
  transitions: {
    candidate: ["scored", "shortlisted", "rejected", "cancelled"],
    scored: ["shortlisted", "rejected", "cancelled"],
    shortlisted: ["approved", "rejected", "cancelled"],
    approved: ["contacted", "rejected", "cancelled"],
    contacted: ["replied", "no_response", "cancelled"],
    replied: ["negotiating", "confirmed", "rejected", "cancelled"],
    negotiating: ["confirmed", "rejected", "cancelled"],
    confirmed: ["contracting", "active", "cancelled"],
    contracting: ["active", "cancelled"],
    active: ["content_submitted", "cancelled"],
    content_submitted: ["published", "active", "cancelled"],
    published: ["completed", "cancelled"],
    completed: [],
    rejected: ["candidate"],
    no_response: ["contacted", "rejected", "cancelled"],
    cancelled: [],
  },
};

export const CONTRACT_SUB_STATUS: Record<string, StatusMeta> = {
  none: { label: "未开始", tone: "neutral" },
  drafting: { label: "起草中", tone: "progress" },
  in_review: { label: "审核中", tone: "progress" },
  sent: { label: "已发送", tone: "info" },
  signed: { label: "已签署", tone: "success" },
  cancelled: { label: "已取消", tone: "danger" },
};

export const PAYMENT_SUB_STATUS: Record<string, StatusMeta> = {
  none: { label: "未开始", tone: "neutral" },
  pending: { label: "待付款", tone: "warning" },
  partial: { label: "部分支付", tone: "progress" },
  paid: { label: "已付款", tone: "success" },
  failed: { label: "付款失败", tone: "danger" },
};

export const CONTENT_SUB_STATUS: Record<string, StatusMeta> = {
  none: { label: "未开始", tone: "neutral" },
  briefed: { label: "已下发 Brief", tone: "info" },
  in_production: { label: "创作中", tone: "progress" },
  submitted: { label: "已提交", tone: "info" },
  approved: { label: "已过审", tone: "success" },
  published: { label: "已发布", tone: "success" },
};

// ---------------------------------------------------------------
// Creator 关系状态（12 态）
// ---------------------------------------------------------------

export const CREATOR_RELATIONSHIP_STATUS: StateMachine = {
  entityType: "creator",
  field: "relationship_status",
  initial: "new",
  states: {
    new: { label: "新达人", tone: "neutral" },
    shortlisted: { label: "已入围", tone: "info" },
    contacted: { label: "已触达", tone: "progress" },
    replied: { label: "已回复", tone: "progress" },
    negotiating: { label: "谈判中", tone: "progress" },
    confirmed: { label: "已确认", tone: "success" },
    active: { label: "合作中", tone: "progress" },
    completed: { label: "已合作", tone: "success" },
    long_term_partner: { label: "长期伙伴", tone: "success" },
    rejected: { label: "已婉拒", tone: "warning" },
    blacklisted: { label: "黑名单", tone: "danger" },
    archived: { label: "已归档", tone: "neutral" },
  },
  transitions: {
    new: ["shortlisted", "contacted", "rejected", "blacklisted", "archived"],
    shortlisted: ["contacted", "rejected", "blacklisted", "archived"],
    contacted: ["replied", "rejected", "blacklisted", "archived"],
    replied: ["negotiating", "confirmed", "rejected", "blacklisted"],
    negotiating: ["confirmed", "rejected", "blacklisted"],
    confirmed: ["active", "rejected", "blacklisted"],
    active: ["completed", "blacklisted"],
    completed: ["long_term_partner", "active", "archived", "blacklisted"],
    long_term_partner: ["active", "archived", "blacklisted"],
    rejected: ["new", "archived", "blacklisted"],
    blacklisted: ["archived"],
    archived: ["new"],
  },
};

export const RISK_LEVEL: Record<string, StatusMeta> = {
  unknown: { label: "未知", tone: "neutral" },
  low: { label: "低风险", tone: "success" },
  medium: { label: "中风险", tone: "warning" },
  high: { label: "高风险", tone: "danger" },
};

// ---------------------------------------------------------------
// Outreach 消息（10 态）
// ---------------------------------------------------------------

export const OUTREACH_MESSAGE_STATUS: StateMachine = {
  entityType: "outreach_message",
  field: "status",
  initial: "draft",
  states: {
    draft: { label: "草稿", tone: "neutral" },
    pending_approval: { label: "待审批", tone: "warning" },
    approved: { label: "已批准", tone: "info" },
    scheduled: { label: "已排期", tone: "info" },
    sent: { label: "已发送", tone: "progress" },
    delivered: { label: "已送达", tone: "progress" },
    opened: { label: "已打开", tone: "progress" },
    replied: { label: "已回复", tone: "success" },
    failed: { label: "发送失败", tone: "danger" },
    cancelled: { label: "已取消", tone: "danger" },
  },
  transitions: {
    draft: ["pending_approval", "cancelled"],
    pending_approval: ["approved", "draft", "cancelled"],
    approved: ["scheduled", "sent", "cancelled"],
    scheduled: ["sent", "cancelled"],
    sent: ["delivered", "opened", "replied", "failed"],
    delivered: ["opened", "replied"],
    opened: ["replied"],
    replied: [],
    failed: ["scheduled", "cancelled"],
    cancelled: [],
  },
};

export const APPROVAL_STATUS: Record<string, StatusMeta> = {
  not_required: { label: "无需审批", tone: "neutral" },
  pending: { label: "待审批", tone: "warning" },
  approved: { label: "已批准", tone: "success" },
  rejected: { label: "已驳回", tone: "danger" },
};

// ---------------------------------------------------------------
// Brief（5 态）
// ---------------------------------------------------------------

export const BRIEF_STATUS: StateMachine = {
  entityType: "brief",
  field: "status",
  initial: "draft",
  states: {
    draft: { label: "草稿", tone: "neutral" },
    in_review: { label: "审核中", tone: "warning" },
    approved: { label: "已批准", tone: "success" },
    locked: { label: "已锁定", tone: "info" },
    archived: { label: "已归档", tone: "neutral" },
  },
  transitions: {
    draft: ["in_review", "archived"],
    in_review: ["approved", "draft", "archived"],
    approved: ["locked", "draft", "archived"],
    locked: ["archived"],
    archived: [],
  },
};

// ---------------------------------------------------------------
// 内容资产（9 态）
// ---------------------------------------------------------------

export const CONTENT_ASSET_STATUS: StateMachine = {
  entityType: "content_asset",
  field: "status",
  initial: "submitted",
  states: {
    draft: { label: "草稿", tone: "neutral" },
    submitted: { label: "已提交", tone: "info" },
    in_review: { label: "审核中", tone: "warning" },
    revision_requested: { label: "需修改", tone: "warning" },
    approved: { label: "已过审", tone: "success" },
    scheduled: { label: "已排期", tone: "info" },
    published: { label: "已发布", tone: "success" },
    rejected: { label: "已拒绝", tone: "danger" },
    archived: { label: "已归档", tone: "neutral" },
  },
  transitions: {
    draft: ["submitted", "archived"],
    submitted: ["in_review", "archived"],
    in_review: ["revision_requested", "approved", "rejected"],
    revision_requested: ["submitted", "archived"],
    approved: ["scheduled", "published", "in_review"],
    scheduled: ["published", "approved"],
    published: ["archived"],
    rejected: ["archived"],
    archived: [],
  },
};

export const CONTENT_REVIEW_STATUS: StateMachine = {
  entityType: "content_review",
  field: "status",
  initial: "queued",
  states: {
    queued: { label: "排队中", tone: "info" },
    reviewing: { label: "审核中", tone: "progress" },
    completed: { label: "已完成", tone: "success" },
  },
  transitions: {
    queued: ["reviewing"],
    reviewing: ["completed"],
    completed: [],
  },
};

export const REPORT_STATUS: StateMachine = {
  entityType: "report",
  field: "status",
  initial: "generating",
  states: {
    generating: { label: "生成中", tone: "progress" },
    draft: { label: "草稿", tone: "neutral" },
    in_review: { label: "审核中", tone: "warning" },
    approved: { label: "已批准", tone: "success" },
    exported: { label: "已导出", tone: "info" },
  },
  transitions: {
    generating: ["draft", "in_review"],
    draft: ["in_review"],
    in_review: ["approved", "draft"],
    approved: ["exported", "draft"],
    exported: [],
  },
};

// ---------------------------------------------------------------
// 合同（8 态）与付款（8 态）
// ---------------------------------------------------------------

export const CONTRACT_STATUS: StateMachine = {
  entityType: "contract",
  field: "status",
  initial: "draft",
  states: {
    draft: { label: "草稿", tone: "neutral" },
    in_review: { label: "审核中", tone: "warning" },
    sent: { label: "已发送", tone: "info" },
    signed: { label: "已签署", tone: "success" },
    active: { label: "生效中", tone: "progress" },
    expired: { label: "已到期", tone: "neutral" },
    cancelled: { label: "已取消", tone: "danger" },
    disputed: { label: "有争议", tone: "danger" },
  },
  transitions: {
    draft: ["in_review", "cancelled"],
    in_review: ["sent", "draft", "cancelled"],
    sent: ["signed", "cancelled"],
    signed: ["active", "disputed"],
    active: ["expired", "disputed"],
    expired: [],
    cancelled: [],
    disputed: ["active", "cancelled"],
  },
};

export const PAYMENT_STATUS: StateMachine = {
  entityType: "payment_record",
  field: "status",
  initial: "not_started",
  states: {
    not_started: { label: "未开始", tone: "neutral" },
    pending_approval: { label: "待审批", tone: "warning" },
    approved: { label: "已批准", tone: "info" },
    scheduled: { label: "已排期", tone: "info" },
    paid: { label: "已付款", tone: "success" },
    failed: { label: "付款失败", tone: "danger" },
    disputed: { label: "有争议", tone: "danger" },
    cancelled: { label: "已取消", tone: "danger" },
  },
  transitions: {
    not_started: ["pending_approval", "cancelled"],
    pending_approval: ["approved", "cancelled"],
    approved: ["scheduled", "paid", "cancelled"],
    scheduled: ["paid", "failed", "cancelled"],
    paid: ["disputed"],
    failed: ["scheduled", "cancelled"],
    disputed: ["paid", "cancelled"],
    cancelled: [],
  },
};

// ---------------------------------------------------------------
// 工作流与 Agent 运行
// ---------------------------------------------------------------

export const WORKFLOW_RUN_STATUS: StateMachine = {
  entityType: "workflow_run",
  field: "status",
  initial: "queued",
  states: {
    draft: { label: "草稿", tone: "neutral" },
    queued: { label: "排队中", tone: "info" },
    running: { label: "运行中", tone: "progress" },
    waiting_for_human: { label: "等待审批", tone: "warning" },
    retrying: { label: "重试中", tone: "warning" },
    completed: { label: "已完成", tone: "success" },
    failed: { label: "失败", tone: "danger" },
    cancelled: { label: "已取消", tone: "neutral" },
  },
  transitions: {
    draft: ["queued", "cancelled"],
    queued: ["running", "cancelled"],
    running: ["waiting_for_human", "retrying", "completed", "failed", "cancelled"],
    waiting_for_human: ["running", "cancelled", "failed"],
    retrying: ["running", "failed", "cancelled"],
    completed: [],
    failed: ["queued"], // 手动重试
    cancelled: [],
  },
};

export const WORKFLOW_STEP_STATUS: Record<string, StatusMeta> = {
  pending: { label: "待执行", tone: "neutral" },
  running: { label: "执行中", tone: "progress" },
  waiting_for_human: { label: "等待审批", tone: "warning" },
  completed: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  skipped: { label: "已跳过", tone: "neutral" },
};

export const AGENT_RUN_STATUS: Record<string, StatusMeta> = {
  running: { label: "运行中", tone: "progress" },
  completed: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
};

export const CHECKPOINT_STATUS: Record<string, StatusMeta> = {
  pending: { label: "待审批", tone: "warning" },
  approved: { label: "已批准", tone: "success" },
  rejected: { label: "已驳回", tone: "danger" },
  changes_requested: { label: "需修改", tone: "warning" },
  escalated: { label: "已升级", tone: "danger" },
};

// ---------------------------------------------------------------
// 知识文档（7 态）
// ---------------------------------------------------------------

export const KNOWLEDGE_DOCUMENT_STATUS: StateMachine = {
  entityType: "knowledge_document",
  field: "status",
  initial: "uploaded",
  states: {
    uploaded: { label: "已上传", tone: "info" },
    parsing: { label: "解析中", tone: "progress" },
    chunking: { label: "分块中", tone: "progress" },
    embedding: { label: "向量化中", tone: "progress" },
    ready: { label: "就绪", tone: "success" },
    failed: { label: "处理失败", tone: "danger" },
    archived: { label: "已归档", tone: "neutral" },
  },
  transitions: {
    uploaded: ["parsing", "archived"],
    parsing: ["chunking", "failed"],
    chunking: ["embedding", "failed"],
    embedding: ["ready", "failed"],
    ready: ["archived", "parsing"], // 重新索引
    failed: ["parsing", "archived"],
    archived: [],
  },
};

// ---------------------------------------------------------------
// 校验工具
// ---------------------------------------------------------------

export class InvalidTransitionError extends Error {
  constructor(
    public machine: string,
    public from: string,
    public to: string,
  ) {
    super(`非法状态转移：${machine} 不允许从 "${from}" 到 "${to}"`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(machine: StateMachine, from: string, to: string): boolean {
  return machine.transitions[from]?.includes(to) ?? false;
}

export function assertTransition(machine: StateMachine, from: string, to: string): void {
  if (!canTransition(machine, from, to)) {
    throw new InvalidTransitionError(machine.entityType, from, to);
  }
}

export function statusMeta(
  source: StateMachine | Record<string, StatusMeta>,
  value: string,
): StatusMeta {
  const states = "states" in source && "transitions" in source ? source.states : source;
  return (states as Record<string, StatusMeta>)[value] ?? { label: value, tone: "neutral" };
}
