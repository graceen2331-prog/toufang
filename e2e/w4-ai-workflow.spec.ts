import { expect, test, type Page } from "@playwright/test";

// 冒烟 #4：AI 基建——UI 生成策略 → SSE 进度 → 审批 → 策略落库（对应 W4 验收）
// 前置：dev server + worker（MODEL_PROVIDER=fake）都在运行

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("admin@demo.com");
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("AI 工作流", () => {
  test("生成策略全链路：触发 → 等待审批 → 批准 → 版本落库", async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);

    // 新建一个干净的 Campaign
    const suffix = Date.now().toString(36);
    await page.goto("/campaigns/new");
    await page.getByLabel("Campaign 名称").fill(`AI 策略测试 ${suffix}`);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /创建/ }).click();
    await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]+/, { timeout: 10_000 });
    const campaignUrl = page.url();

    // 策略 Tab → 生成策略
    await page.getByRole("tab", { name: "策略" }).click();
    await page.getByRole("button", { name: /AI 生成策略/ }).click();

    // SSE 进度出现，等待审批提示（worker 用 fake provider，秒级完成）
    await expect(page.getByText("等待人工审批")).toBeVisible({ timeout: 30_000 });

    // 前往审批中心批准
    await page.getByRole("link", { name: "前往审批中心" }).click();
    await expect(page).toHaveURL(/\/approvals/);
    const card = page
      .locator("div")
      .filter({ hasText: /策略草案审批：AI 策略测试/ })
      .first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "批准" }).first().click();
    // ConfirmDialog 二次确认（按钮文案同为「批准」）
    const approveDialog = page.getByRole("dialog");
    await approveDialog.getByPlaceholder("批准意见（至少 5 个字）").fill("已核对策略内容，可以继续执行");
    await approveDialog.getByRole("button", { name: "确认批准" }).click();
    await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 10_000 });

    // 回到 Campaign 策略 Tab，策略版本已落库
    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "策略" }).click();
    await expect(page.getByText(/成分实证|策略/).first()).toBeVisible({ timeout: 30_000 });

    // AI 监控页可见运行记录与成本
    await page.goto("/ai-runs");
    await expect(page.getByText("策略生成").first()).toBeVisible();
    await expect(page.getByText("本月已用")).toBeVisible();
  });
});
