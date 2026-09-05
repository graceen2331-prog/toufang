import { expect, test } from "./fixtures";

// 冒烟 #2：达人域——列表筛选 / 详情 / 状态推进 / CRM 看板（对应 W2 验收）

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("admin@demo.com");
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("达人域", () => {
  test("列表加载 seed 数据并支持状态筛选", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("link", { name: "达人库" }).click();
    await expect(page).toHaveURL(/\/creators/);
    // seed 有 50 位达人，第一页 20 条
    await expect(page.locator("tbody tr")).toHaveCount(20);

    // 状态筛选：黑名单（placeholderData 会先显示旧数据，需轮询等待）
    await page.getByRole("combobox").filter({ hasText: "关系状态" }).click();
    await page.getByRole("option", { name: "黑名单" }).click();
    await expect
      .poll(async () => page.locator("tbody tr").count(), { timeout: 10_000 })
      .toBeLessThan(20);
  });

  test("详情页展示信息并可推进状态", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/creators?relationship_status=new");
    await page.locator("tbody tr").first().click();
    await expect(page).toHaveURL(/\/creators\/[0-9a-f-]+/);
    await expect(page.getByText("总粉丝量")).toBeVisible();

    // 推进状态：新达人 → 已入围
    await page.getByRole("button", { name: "变更状态" }).click();
    await page.getByRole("menuitem", { name: "已入围" }).click();
    await expect(page.getByText("关系状态已更新")).toBeVisible();

    // 动态 tab 出现状态历史
    await page.getByRole("tab", { name: "动态" }).click();
    await expect(page.getByText("新达人").first()).toBeVisible();
  });

  test("新建达人并出现在列表", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/creators");
    const suffix = Date.now().toString(36);
    await page.getByRole("button", { name: "新建达人" }).click();
    await page.getByLabel("达人名称").fill(`E2E 达人 ${suffix}`);
    await page.getByLabel("内容分类").fill("测试分类");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText(`达人「E2E 达人 ${suffix}」已创建`)).toBeVisible();
    await page.goto(`/creators?q=${encodeURIComponent(`E2E 达人 ${suffix}`)}`);
    await expect(page.getByRole("cell", { name: `E2E 达人 ${suffix}` })).toBeVisible();
  });

  test("CRM 看板展示各阶段列", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/creators/crm");
    await expect(page.getByText("达人 CRM")).toBeVisible();
    await expect(page.getByText("谈判中", { exact: true })).toBeVisible();
    await expect(page.getByText("长期伙伴", { exact: true })).toBeVisible();
  });
});
