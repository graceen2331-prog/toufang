import { defineConfig } from "@playwright/test";

const managedServer = process.env.E2E_MANAGED_SERVER === "1";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // GitHub 托管 runner 首次编译大型路由可能超过 15 秒。
  expect: { timeout: 30_000 },
  retries: 0,
  // 工作流类测试共享审批中心，串行执行避免互相抢审批项
  workers: 1,
  use: {
    baseURL,
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  ...(managedServer
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            MODEL_PROVIDER: "fake",
          },
        },
      }),
});
