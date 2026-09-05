import { expect, test, type Page } from "./fixtures";

async function login(page: Page, email: string) {
  await page.goto("/login");
  const account = page.getByRole("button", { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  if ((await account.count()) > 0) {
    await account.click();
  } else {
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("demo1234");
  }
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Agent 运行监测", () => {
  test("管理员下钻模型调用并审计完整内容查看", async ({ page }) => {
    await login(page, "admin@demo.com");
    await page.goto("/ai-runs");

    await expect(page.getByRole("heading", { name: "Agent 运行监测" })).toBeVisible();
    await expect(page.getByText("最近 24 小时运行趋势")).toBeVisible();
    await expect(page.getByText("队列与 Worker")).toBeVisible();

    const runRow = page.getByRole("row").filter({ hasText: "内容改写" }).first();
    await expect(runRow).toBeVisible();
    await runRow.click();
    await expect(page).toHaveURL(/\/ai-runs\/agents\/[0-9a-f-]+/);
    await expect(page.getByText("Agent 运行时间线")).toBeVisible();
    await expect(page.getByText("模型调用明细")).toBeVisible();
    await expect(page.getByText("结构修复").first()).toBeVisible();

    await page.getByRole("button", { name: "查看完整内容" }).click();
    await expect(page.getByText(/本次查看已写入审计日志/)).toBeVisible();
    await expect(page.getByText("完整上下文已展开")).toBeVisible();

    await page.goto("/audit-logs");
    await page.getByPlaceholder("搜索 action").fill("agent_run.sensitive_view");
    await expect(page.getByText("agent_run.sensitive_view").first()).toBeVisible({ timeout: 10_000 });
  });

  test("市场经理只能查看脱敏上下文", async ({ page }) => {
    await login(page, "manager@demo.com");
    await page.goto("/ai-runs");
    const runRow = page.getByRole("row").filter({ hasText: "内容改写" }).first();
    await expect(runRow).toBeVisible();
    await runRow.click();
    await expect(page.getByText("仅管理员可查看原文")).toBeVisible();
    await expect(page.getByRole("button", { name: "查看完整内容" })).toHaveCount(0);
    await expect(page.getByText("队列与 Worker")).toHaveCount(0);
  });
});
