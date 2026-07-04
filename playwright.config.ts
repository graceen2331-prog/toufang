import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  // 工作流类测试共享审批中心，串行执行避免互相抢审批项
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      MODEL_PROVIDER: "fake",
    },
  },
});
