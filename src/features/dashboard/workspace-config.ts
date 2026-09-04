import { roleHasPermission, type Permission } from "@/shared/constants/permissions";

export type DashboardResource =
  "analytics" | "campaigns" | "reports" | "approvals" | "outreach" | "content" | "contracts";

export type DashboardActionKey =
  | "new_campaign"
  | "campaign_risk"
  | "analytics"
  | "reports"
  | "approvals"
  | "outreach"
  | "content"
  | "contracts";

export interface DashboardActionPreset {
  key: DashboardActionKey;
  href: string;
  permission: Permission;
}

export interface DashboardWorkspacePreset {
  title: string;
  roleLabel: string;
  description: string;
  resources: DashboardResource[];
  actions: DashboardActionPreset[];
}

const PRESETS: Record<string, DashboardWorkspacePreset> = {
  admin: {
    title: "经营总览",
    roleLabel: "管理员工作台",
    description: "从业务结果、执行风险和关键审批三个视角掌握组织运行状态。",
    resources: ["analytics", "campaigns", "approvals", "reports"],
    actions: [
      { key: "approvals", href: "/approvals", permission: "approval:read" },
      { key: "campaign_risk", href: "/campaigns", permission: "campaign:read" },
      { key: "analytics", href: "/analytics", permission: "analytics:read" },
      { key: "new_campaign", href: "/campaigns/new", permission: "campaign:write" },
    ],
  },
  director: {
    title: "经营总览",
    roleLabel: "市场总监工作台",
    description: "聚焦 Campaign 组合表现、业务风险与需要拍板的关键事项。",
    resources: ["analytics", "campaigns", "approvals", "reports"],
    actions: [
      { key: "approvals", href: "/approvals", permission: "approval:read" },
      { key: "campaign_risk", href: "/campaigns", permission: "campaign:read" },
      { key: "reports", href: "/reports", permission: "report:read" },
      { key: "new_campaign", href: "/campaigns/new", permission: "campaign:write" },
    ],
  },
  manager: {
    title: "Campaign 指挥台",
    roleLabel: "市场经理工作台",
    description: "优先处理执行风险、审批积压和待复盘 Campaign。",
    resources: ["campaigns", "analytics", "approvals", "reports"],
    actions: [
      { key: "campaign_risk", href: "/campaigns", permission: "campaign:read" },
      { key: "approvals", href: "/approvals", permission: "approval:read" },
      { key: "reports", href: "/reports", permission: "report:read" },
      { key: "new_campaign", href: "/campaigns/new", permission: "campaign:write" },
    ],
  },
  kol_manager: {
    title: "达人推进台",
    roleLabel: "达人运营工作台",
    description: "聚焦待跟进会话、谈判进展和合作节点，减少达人推进停滞。",
    resources: ["outreach", "campaigns", "contracts"],
    actions: [
      { key: "outreach", href: "/outreach", permission: "outreach:read" },
      { key: "campaign_risk", href: "/campaigns", permission: "campaign:read" },
      { key: "contracts", href: "/contracts", permission: "contract:read" },
    ],
  },
  content_manager: {
    title: "内容审核台",
    roleLabel: "内容负责人工作台",
    description: "聚焦待审、待修改和高风险内容，确保发布前证据完整。",
    resources: ["content", "approvals", "campaigns", "analytics"],
    actions: [
      { key: "content", href: "/content-review", permission: "content:read" },
      { key: "approvals", href: "/approvals", permission: "approval:read" },
      { key: "analytics", href: "/analytics", permission: "analytics:read" },
    ],
  },
  finance: {
    title: "合同与资金台",
    roleLabel: "财务工作台",
    description: "聚焦合同履约、付款审批和待对账金额，不把资金事项混入营销噪声。",
    resources: ["contracts", "approvals", "reports"],
    actions: [
      { key: "approvals", href: "/approvals?type=payment", permission: "approval:read" },
      { key: "contracts", href: "/contracts", permission: "contract:read" },
      { key: "reports", href: "/reports", permission: "report:read" },
    ],
  },
  viewer: {
    title: "业务观察台",
    roleLabel: "只读工作台",
    description: "查看已授权的 Campaign、效果与报告摘要，不显示任何写操作。",
    resources: ["analytics", "campaigns", "reports"],
    actions: [
      { key: "campaign_risk", href: "/campaigns", permission: "campaign:read" },
      { key: "analytics", href: "/analytics", permission: "analytics:read" },
      { key: "reports", href: "/reports", permission: "report:read" },
    ],
  },
};

const FALLBACK_PRESET: DashboardWorkspacePreset = {
  title: "我的工作台",
  roleLabel: "自定义角色",
  description: "根据当前角色的实际权限展示可用数据与行动入口。",
  resources: ["campaigns", "analytics", "approvals", "outreach", "content", "contracts", "reports"],
  actions: [
    { key: "approvals", href: "/approvals", permission: "approval:read" },
    { key: "campaign_risk", href: "/campaigns", permission: "campaign:read" },
    { key: "outreach", href: "/outreach", permission: "outreach:read" },
    { key: "content", href: "/content-review", permission: "content:read" },
    { key: "contracts", href: "/contracts", permission: "contract:read" },
    { key: "analytics", href: "/analytics", permission: "analytics:read" },
    { key: "reports", href: "/reports", permission: "report:read" },
  ],
};

const RESOURCE_PERMISSIONS: Record<DashboardResource, Permission> = {
  analytics: "analytics:read",
  campaigns: "campaign:read",
  reports: "report:read",
  approvals: "approval:read",
  outreach: "outreach:read",
  content: "content:read",
  contracts: "contract:read",
};

export function resolveDashboardPreset(
  roleKey: string | null | undefined,
  permissions: string[],
): DashboardWorkspacePreset {
  const preset = (roleKey && PRESETS[roleKey]) || FALLBACK_PRESET;
  return {
    ...preset,
    resources: preset.resources.filter((resource) =>
      roleHasPermission(permissions, RESOURCE_PERMISSIONS[resource]),
    ),
    actions: preset.actions.filter((action) => roleHasPermission(permissions, action.permission)),
  };
}

export function dashboardPermissionFingerprint(permissions: string[]): string {
  return [...new Set(permissions)].sort().join("|") || "none";
}

export function dashboardCan(permissions: string[], permission: Permission): boolean {
  return roleHasPermission(permissions, permission);
}
