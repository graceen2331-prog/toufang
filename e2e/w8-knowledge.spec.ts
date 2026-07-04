import { expect, test, type Page } from "@playwright/test";

// 冒烟 #8：知识库 / RAG + Admin 权限门
// 前置：pnpm seed；dev（MODEL_PROVIDER=fake）运行中。seed 文档已预生成向量，不依赖 worker。

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("W8 知识库 / RAG", () => {
  test("知识库：已有文档可见 → 提问 → 返回带引用答案", async ({ page }) => {
    test.slow();
    await login(page, "admin@demo.com");

    await page.goto("/knowledge");
    await expect(page.getByRole("heading", { name: "知识库" })).toBeVisible();
    await expect(page.getByText("GlowLab 双十一内容复盘知识卡")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("就绪").first()).toBeVisible();

    await page
      .getByPlaceholder("例如：双十一美妆 Campaign 哪类内容更适合承接转化？")
      .fill("双十一美妆 Campaign 哪类内容更适合承接转化？");
    await page.getByRole("button", { name: "提问" }).click();

    await expect(page.getByText(/\[1\]/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("引用来源")).toBeVisible();
    await expect(page.getByText("GlowLab 双十一内容复盘知识卡").first()).toBeVisible();
  });

  test("viewer 访问组织成员页时看到权限拒绝态", async ({ page }) => {
    await login(page, "viewer@demo.com");

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "组织成员" })).toBeVisible();
    await expect(page.getByText("没有访问权限")).toBeVisible({ timeout: 15_000 });
  });
});
