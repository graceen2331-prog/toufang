import { expect, test, type Page } from "@playwright/test";

// 冒烟 #5：发现/评分/Brief 工作流 UI（对应 W5 验收）
// 前置：dev + worker（MODEL_PROVIDER=fake）运行中

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("admin@demo.com");
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function createCampaign(page: Page, name: string): Promise<string> {
  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign 名称").fill(name);
  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: /创建/ }).click();
  await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]+/, { timeout: 10_000 });
  return page.url();
}

async function approveFirst(page: Page, titlePattern: RegExp) {
  await page.goto("/approvals");
  const card = page.locator("div").filter({ hasText: titlePattern }).first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "批准" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "批准" }).click();
  await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 10_000 });
}

test.describe("发现/评分/Brief 工作流", () => {
  test("流水线 Tab：达人发现 → 审批 → 候选入池 → 评分 → 入围", async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);
    const suffix = Date.now().toString(36);
    const campaignUrl = await createCampaign(page, `流水线测试 ${suffix}`);

    // 达人发现
    await page.getByRole("tab", { name: "流水线" }).click();
    await page.getByRole("button", { name: "运行" }).nth(1).click(); // 第二张卡=达人发现
    await expect(page.getByText("等待人工审批")).toBeVisible({ timeout: 30_000 });
    await approveFirst(page, /达人候选名单确认：流水线测试/);

    // 回详情看达人 Tab 有候选
    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "达人", exact: true }).click();
    await expect(page.getByText("候选").first()).toBeVisible({ timeout: 15_000 });

    // 评分
    await page.getByRole("tab", { name: "流水线" }).click();
    await page.getByRole("button", { name: "运行" }).nth(2).click(); // 第三张卡=达人评分
    await expect(page.getByText("等待人工审批")).toBeVisible({ timeout: 30_000 });
    await approveFirst(page, /达人入围名单审批：流水线测试/);

    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "达人", exact: true }).click();
    await expect(page.getByText("已入围").first()).toBeVisible({ timeout: 15_000 });
  });

  test("Brief Tab：AI 生成 → 审批 → 版本渲染 → 手动编辑存新版", async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);
    const suffix = Date.now().toString(36);
    const campaignUrl = await createCampaign(page, `Brief 测试 ${suffix}`);

    await page.getByRole("tab", { name: "Brief" }).click();
    await page.getByRole("button", { name: /AI 生成 Brief/ }).click();
    await expect(page.getByText("等待人工审批")).toBeVisible({ timeout: 30_000 });
    await approveFirst(page, /Brief 审批/);

    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "Brief" }).click();
    await expect(page.getByText("焕亮维C精华 双十一种草 Brief")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("禁止出现")).toBeVisible();

    // 手动编辑存新版
    await page.getByRole("button", { name: "编辑" }).click();
    await page.getByLabel("标题").fill(`人工修订 Brief ${suffix}`);
    await page.getByRole("button", { name: /保存/ }).click();
    await expect(page.getByText("已保存新版本")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(`人工修订 Brief ${suffix}`).first()).toBeVisible();
  });
});
