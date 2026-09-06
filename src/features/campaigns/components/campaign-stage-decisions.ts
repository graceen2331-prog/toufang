export const STAGE_LABELS: Record<string, string> = {
  draft: "草稿",
  strategy: "策略",
  research: "研究",
  creator_discovery: "达人发现",
  shortlisting: "筛选",
  brief_creation: "Brief",
  outreach: "触达",
  negotiation: "谈判",
  contracting: "签约",
  content_creation: "内容制作",
  content_review: "内容审核",
  publishing: "发布",
  metrics_collection: "数据回收",
  reporting: "复盘",
  completed: "已完成",
};

export type CampaignWorkflowKey =
  | "strategy"
  | "research"
  | "creator_discovery"
  | "creator_scoring"
  | "brief";

export interface StageDecision {
  mode: "AI 建议 + 人审" | "AI 分析 + 人工决策" | "人工决策" | "系统归档";
  aiDecision: string;
  humanDecision: string;
  systemAction: string;
  approvalGate: string;
  workflowKey?: CampaignWorkflowKey;
  workflowLabel?: string;
}

export const STAGE_DECISIONS: Record<string, StageDecision> = {
  draft: {
    mode: "AI 建议 + 人审",
    aiDecision: "生成策略草案，给出预算配比、达人组合和关键风险。",
    humanDecision: "确认业务目标、预算上限和策略方向，再决定是否采纳。",
    systemAction: "策略审批通过后自动落地版本，并推进到策略阶段。",
    approvalGate: "策略草案审批",
    workflowKey: "strategy",
    workflowLabel: "运行 AI 策略",
  },
  strategy: {
    mode: "AI 分析 + 人工决策",
    aiDecision: "基于已批准策略补充市场、竞品、风险与内容机会。",
    humanDecision: "判断研究结论是否足够支撑达人发现和预算分配。",
    systemAction: "研究通过后沉淀为洞察与知识文档。",
    approvalGate: "研究结论确认",
    workflowKey: "research",
    workflowLabel: "运行 AI 研究",
  },
  research: {
    mode: "AI 分析 + 人工决策",
    aiDecision: "补齐市场证据、受众语境和潜在风险。",
    humanDecision: "确认研究方向，决定是否进入达人发现。",
    systemAction: "保留研究产物，作为达人匹配上下文。",
    approvalGate: "研究结论确认",
    workflowKey: "research",
    workflowLabel: "补充 AI 研究",
  },
  creator_discovery: {
    mode: "AI 建议 + 人审",
    aiDecision: "从达人库检索候选，按品牌适配、平台表现和风险生成推荐名单。",
    humanDecision: "审核候选名单，剔除不适合品牌或档期不确定的达人。",
    systemAction: "通过后把达人写入 Campaign 管道。",
    approvalGate: "候选名单确认",
    workflowKey: "creator_discovery",
    workflowLabel: "运行 AI 发现",
  },
  shortlisting: {
    mode: "AI 建议 + 人审",
    aiDecision: "对候选达人做六维评分，推荐 shortlist 与合作角色。",
    humanDecision: "审批入围名单，处理预算、品牌安全和组合均衡。",
    systemAction: "审批通过后推进达人到入围状态并保留评分溯源。",
    approvalGate: "入围名单审批",
    workflowKey: "creator_scoring",
    workflowLabel: "运行 AI 评分",
  },
  brief_creation: {
    mode: "AI 建议 + 人审",
    aiDecision: "生成 Brief 草案，覆盖核心信息、禁用表达、交付物和平台要求。",
    humanDecision: "编辑并批准 Brief，确认达人收到的是最终可执行版本。",
    systemAction: "审批后创建 Brief 版本并进入可锁定状态。",
    approvalGate: "Brief 审批",
    workflowKey: "brief",
    workflowLabel: "运行 AI Brief",
  },
  outreach: {
    mode: "AI 建议 + 人审",
    aiDecision: "生成外联话术、个性化卖点和跟进建议。",
    humanDecision: "审批外发内容，确认语气、权益和报价边界。",
    systemAction: "审批通过后允许标记发送并记录回复。",
    approvalGate: "外联发送审批",
  },
  negotiation: {
    mode: "AI 分析 + 人工决策",
    aiDecision: "分析回复、报价、档期和授权风险，给出谈判建议。",
    humanDecision: "决定报价区间、让步条件和是否继续推进。",
    systemAction: "记录谈判结论，达成一致后进入签约。",
    approvalGate: "商务判断",
  },
  contracting: {
    mode: "AI 分析 + 人工决策",
    aiDecision: "提示合同条款、付款节点、授权范围与风险点。",
    humanDecision: "审批合同和付款，确认资金与法务边界。",
    systemAction: "合同/付款审批通过后同步子状态。",
    approvalGate: "合同与付款审批",
  },
  content_creation: {
    mode: "AI 分析 + 人工决策",
    aiDecision: "按 Brief 检查内容方向，提示缺失素材和潜在偏差。",
    humanDecision: "确认达人交付物是否可进入正式审核。",
    systemAction: "内容提交后进入 AI 审核与人工复核链路。",
    approvalGate: "内容提交确认",
  },
  content_review: {
    mode: "AI 建议 + 人审",
    aiDecision: "识别合规、品牌、功效承诺和平台风险，生成 findings。",
    humanDecision: "对 AI findings 做最终判断，决定通过、退回或修改。",
    systemAction: "复核通过后允许进入发布。",
    approvalGate: "内容人工复核",
  },
  publishing: {
    mode: "人工决策",
    aiDecision: "检查发布时间窗口、平台要求和指标采集口径。",
    humanDecision: "确认发布链接、发布时间和投放节奏。",
    systemAction: "记录发布状态并开放指标录入。",
    approvalGate: "发布确认",
  },
  metrics_collection: {
    mode: "AI 分析 + 人工决策",
    aiDecision: "识别异常指标、KPI 缺口和内容表现差异。",
    humanDecision: "确认数据完整性，决定是否补采或修正口径。",
    systemAction: "归一化指标并进入复盘分析。",
    approvalGate: "数据质量确认",
  },
  reporting: {
    mode: "AI 建议 + 人审",
    aiDecision: "生成复盘洞察、预算效率结论和下一轮建议。",
    humanDecision: "审批正式报告，确认可对外或归档的表达。",
    systemAction: "报告通过后可导出并沉淀到知识库。",
    approvalGate: "报告审批",
  },
  completed: {
    mode: "系统归档",
    aiDecision: "提取可复用经验、风险模式和下次优化建议。",
    humanDecision: "确认复盘闭环，决定是否归档。",
    systemAction: "关闭 Campaign 并保留审计、AI 溯源和知识沉淀。",
    approvalGate: "完成确认",
  },
};

export function getStageDecision(status: string): StageDecision {
  return (
    STAGE_DECISIONS[status] ?? {
      mode: "人工决策",
      aiDecision: "暂无绑定的 AI 决策。",
      humanDecision: "确认当前阶段产物后再推进。",
      systemAction: "记录状态变更与审计日志。",
      approvalGate: "人工确认",
    }
  );
}
