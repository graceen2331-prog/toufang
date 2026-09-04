// 权限字符串单一事实源
// 命名：<资源>:<动作>；roles.permissions 存字符串数组，"*" 表示全部

export const PERMISSIONS = {
  // 品牌与产品
  "brand:read": "查看品牌",
  "brand:write": "管理品牌",
  // 达人
  "creator:read": "查看达人",
  "creator:write": "管理达人",
  "creator:contact:read": "查看达人联系方式",
  "creator:export": "导出达人数据",
  // Campaign
  "campaign:read": "查看 Campaign",
  "campaign:write": "管理 Campaign",
  "campaign:status": "变更 Campaign 状态",
  // 外联
  "outreach:read": "查看外联",
  "outreach:write": "管理外联",
  "outreach:send": "发送外联消息",
  // Brief 与内容
  "brief:read": "查看 Brief",
  "brief:write": "管理 Brief",
  "content:read": "查看内容",
  "content:review": "审核内容",
  // 合同与付款
  "contract:read": "查看合同",
  "contract:write": "管理合同",
  "payment:read": "查看付款",
  "payment:write": "管理付款",
  "payment:approve": "审批付款",
  "payment:reconcile": "登记付款与对账",
  // 分析与报告
  "analytics:read": "查看分析",
  "analytics:write": "录入分析指标",
  "report:read": "查看报告",
  "report:write": "管理报告",
  "report:export": "导出报告",
  // 知识库
  "knowledge:read": "查看知识库",
  "knowledge:write": "管理知识库",
  // AI
  "ai:run": "运行 AI 任务",
  "ai:monitor": "查看 AI 运行监控",
  "admin:ai_trace": "查看 AI 运行完整上下文",
  "admin:ai_infrastructure": "查看 AI 队列与 Worker 健康",
  // 审批
  "approval:read": "查看审批",
  "approval:decide": "处理审批",
  "approval:assign": "转交审批",
  "approval:escalate": "升级审批",
  // 管理
  "admin:users": "管理用户与角色",
  "admin:integrations": "管理集成",
  "admin:ai_settings": "管理 AI 设置",
  "admin:audit": "查看审计日志",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** 系统内置角色 → 权限映射（seed 时写入 roles 表） */
export const SYSTEM_ROLES: Record<string, { name: string; permissions: Permission[] | ["*"] }> = {
  admin: { name: "管理员", permissions: ["*"] },
  director: {
    name: "市场总监",
    permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith("admin:")).concat([
      "admin:audit",
    ]) as Permission[],
  },
  manager: {
    name: "市场经理",
    permissions: [
      "brand:read",
      "brand:write",
      "creator:read",
      "creator:write",
      "creator:contact:read",
      "campaign:read",
      "campaign:write",
      "campaign:status",
      "outreach:read",
      "outreach:write",
      "brief:read",
      "brief:write",
      "content:read",
      "content:review",
      "contract:read",
      "analytics:read",
      "analytics:write",
      "report:read",
      "report:write",
      "report:export",
      "knowledge:read",
      "knowledge:write",
      "ai:run",
      "ai:monitor",
      "approval:read",
      "approval:decide",
      "approval:assign",
      "approval:escalate",
    ],
  },
  kol_manager: {
    name: "达人运营",
    permissions: [
      "brand:read",
      "creator:read",
      "creator:write",
      "creator:contact:read",
      "campaign:read",
      "outreach:read",
      "outreach:write",
      "outreach:send",
      "brief:read",
      "content:read",
      "contract:read",
      "analytics:read",
      "analytics:write",
      "knowledge:read",
      "ai:run",
      "approval:read",
    ],
  },
  content_manager: {
    name: "内容负责人",
    permissions: [
      "brand:read",
      "creator:read",
      "campaign:read",
      "brief:read",
      "brief:write",
      "content:read",
      "content:review",
      "analytics:read",
      "analytics:write",
      "knowledge:read",
      "knowledge:write",
      "ai:run",
      "approval:read",
      "approval:decide",
      "approval:escalate",
    ],
  },
  finance: {
    name: "财务",
    permissions: [
      "campaign:read",
      "contract:read",
      "contract:write",
      "payment:read",
      "payment:write",
      "payment:approve",
      "payment:reconcile",
      "analytics:read",
      "report:read",
      "report:export",
      "approval:read",
      "approval:decide",
    ],
  },
  viewer: {
    name: "只读成员",
    permissions: [
      "brand:read",
      "creator:read",
      "campaign:read",
      "outreach:read",
      "brief:read",
      "content:read",
      "analytics:read",
      "report:read",
      "knowledge:read",
    ],
  },
};

export function roleHasPermission(permissions: string[], required: Permission): boolean {
  return permissions.includes("*") || permissions.includes(required);
}
