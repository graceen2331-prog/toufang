import { expect, test, type Page } from "./fixtures";

// 冒烟 #3：Campaign 域——列表 / 创建 / 详情状态推进 / 达人管道 / 审批中心（对应 W3 验收）

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("admin@demo.com");
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Campaign 域", () => {
  test("列表展示 seed Campaign", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/campaigns?q=焕亮");
    await expect(page).toHaveURL(/\/campaigns/);
    await expect(page.getByText("焕亮维C精华 双十一种草战役")).toBeVisible();
    await page.goto("/campaigns?q=UT-1");
    await expect(page.getByText("UT-1 跑鞋城市轻越野首发")).toBeVisible();
  });

  test("创建 Campaign → 详情推进状态 → 时间线可见", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/campaigns/new");
    const suffix = Date.now().toString(36);
    await page.getByLabel("Campaign 名称").fill(`E2E 战役 ${suffix}`);
    // 品牌下拉选第一个
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /创建/ }).click();
    await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]+/, { timeout: 10_000 });
    await expect(page.getByText("AI 决策").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /运行 AI 策略/ })).toBeVisible();

    // 主流程推进：draft → strategy
    await page.getByRole("button", { name: /推进到「策略」/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "确认推进" }).click();
    await expect(page.getByText("策略制定").first()).toBeVisible({ timeout: 10_000 });

    // 概览里的状态历史应记录真实推进事件
    const historyCard = page.locator('[data-slot="card"]').filter({ hasText: "状态历史" });
    await expect(historyCard.getByText("草稿").first()).toBeVisible();
    await expect(historyCard.getByText("策略制定").first()).toBeVisible();
  });

  test("详情页达人管道展示子状态", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/campaigns?q=焕亮");
    await page.getByText("焕亮维C精华 双十一种草战役").click();
    await page.getByRole("tab", { name: "达人" }).click();
    await expect(page.getByText("谈判中").first()).toBeVisible();
    await expect(page.getByText("执行中").first()).toBeVisible();
  });

  test("审批中心展示待审批并可批准", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/approvals");
    await expect(page.getByText(/预算调整/).first()).toBeVisible();
    // 顶栏审批红点
    await expect(page.getByLabel("审批中心")).toBeVisible();
  });
});
