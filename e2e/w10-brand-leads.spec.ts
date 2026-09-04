import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "admin@demo.com") {
  await page.goto("/login");
  const emailInput = page.getByLabel("邮箱");
  await emailInput.clear();
  await emailInput.fill(email);
  const passwordInput = page.getByLabel("密码");
  await passwordInput.clear();
  await passwordInput.fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("品牌机会雷达", () => {
  test("CES 品牌线索可筛选、查看详情并发起 Campaign", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: "品牌机会雷达" }).click();
    await expect(page).toHaveURL(/\/brand-leads/);
    await expect(page.getByRole("heading", { name: "品牌机会雷达" })).toBeVisible();
    await expect(
      page.getByText("品牌线索", { exact: true }).first().locator("..").locator(".."),
    ).toContainText("6");
    await expect(page.getByText("第 1 页")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova Robotics 机器人" })).toBeVisible();

    await page.getByRole("button", { name: "详情" }).first().click();
    await expect(page.getByRole("dialog")).toContainText("推荐达人画像");
    await expect(page.getByRole("dialog")).toContainText("品牌画像");
    await expect(page.getByRole("dialog")).toContainText("美国");
    const websitePagePromise = page.context().waitForEvent("page");
    await page.getByRole("link", { name: "打开官网" }).click();
    const websitePage = await websitePagePromise;
    await expect(websitePage).toHaveURL(/^https:\/\/example\.com\/nova-robotics/);
    await websitePage.close();
    await page.keyboard.press("Escape");

    await page.getByPlaceholder("搜索品牌、官网或描述").fill("LumaCare");
    await expect(page.getByText("第 1 页")).toBeVisible();
    await expect(page.getByRole("button", { name: "LumaCare Health 健康科技" })).toBeVisible();

    await page.getByRole("button", { name: "详情" }).click();
    await page.getByRole("button", { name: "发起 Campaign" }).click();
    const convertDialog = page.getByRole("dialog", { name: "从品牌机会发起 Campaign" });
    await expect(convertDialog).toBeVisible();
    await convertDialog.getByLabel("Campaign 目标").click();
    await page.getByRole("option", { name: "新品发布" }).click();
    await convertDialog.getByText("小红书", { exact: true }).click();
    await convertDialog.getByRole("button", { name: "创建并进入 Campaign" }).click();

    await expect(page).toHaveURL(/\/campaigns\/[a-z0-9-]+$/);
    await expect(
      page.getByRole("heading", { name: "LumaCare Health 健康科技 合作 Campaign" }),
    ).toBeVisible();
  });
});
