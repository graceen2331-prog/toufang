import {
  BarChart3,
  BellRing,
  BookOpen,
  Bot,
  CheckSquare,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { Permission } from "@/shared/constants/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** 需要的权限；不填 = 登录即可见 */
  permission?: Permission;
}

export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

/**
 * 全局导航配置。侧边栏按权限过滤渲染。
 * 注意：只放已实现的页面，每波开发解锁对应条目。
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [{ title: "工作台", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "营销执行",
    items: [
      { title: "Campaign", href: "/campaigns", icon: Megaphone, permission: "campaign:read" },
      { title: "达人库", href: "/creators", icon: Users, permission: "creator:read" },
      { title: "外联工作台", href: "/outreach", icon: MessageSquare, permission: "outreach:read" },
      { title: "内容审核", href: "/contents/review", icon: CheckSquare, permission: "content:review" },
      { title: "合同与付款", href: "/contracts", icon: Wallet, permission: "contract:read" },
    ],
  },
  {
    title: "洞察与知识",
    items: [
      { title: "数据分析", href: "/analytics", icon: BarChart3, permission: "analytics:read" },
      { title: "知识库", href: "/knowledge", icon: BookOpen, permission: "knowledge:read" },
      { title: "AI 运行监控", href: "/ai-runs", icon: Bot, permission: "ai:monitor" },
    ],
  },
  {
    title: "协作",
    items: [
      { title: "审批中心", href: "/approvals", icon: ShieldCheck, permission: "approval:read" },
      { title: "通知", href: "/notifications", icon: BellRing },
    ],
  },
  {
    title: "管理",
    items: [
      { title: "品牌与产品", href: "/brands", icon: Package, permission: "brand:read" },
      { title: "组织管理", href: "/admin/users", icon: Users, permission: "admin:users" },
      { title: "审计日志", href: "/audit-logs", icon: ScrollText, permission: "admin:audit" },
      { title: "设置", href: "/settings", icon: Settings },
    ],
  },
];

/** 当前波次已实现的路由（未实现的自动隐藏，避免 404） */
export const IMPLEMENTED_ROUTES = new Set(["/dashboard", "/brands", "/creators"]);
