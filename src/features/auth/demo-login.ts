import "server-only";

export interface DemoLoginConfig {
  password: string;
  accounts: Array<{ label: string; email: string; role: string }>;
}

export function getDemoLoginConfig(env: NodeJS.ProcessEnv = process.env): DemoLoginConfig | null {
  if (env.NODE_ENV === "production" || env.ENABLE_DEMO_LOGIN === "false") return null;
  return {
    password: env.DEMO_LOGIN_PASSWORD ?? "demo1234",
    accounts: [
      { label: "管理员", email: "admin@demo.com", role: "全权限 / 双组织" },
      { label: "市场经理", email: "manager@demo.com", role: "Campaign 与审批" },
      { label: "达人运营", email: "kol@demo.com", role: "达人管道" },
      { label: "财务", email: "finance@demo.com", role: "付款审批与对账" },
      { label: "只读成员", email: "viewer@demo.com", role: "权限拒绝态" },
      { label: "北辰管理员", email: "admin2@demo.com", role: "第二组织" },
    ],
  };
}
