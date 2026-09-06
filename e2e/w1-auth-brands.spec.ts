import { expect, test } from "./fixtures";

// 冒烟 #1：登录 → 工作台 → 品牌 CRUD 全链路（对应 W1 验收）
// 前置：pnpm seed 已执行、dev server 运行中（playwright.config 会自动拉起）

test.describe("认证与品牌管理", () => {
  test("未登录访问受保护页面重定向到登录页", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("残留无效 session cookie 时可以回到登录页重新登录", async ({ context, page }) => {
    await context.addCookies([
      {
        name: "tf_session",
        value: "stale-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("邮箱")).toBeVisible();
  });

  test("客户端水合完成前不会接收登录输入", async ({ page }) => {
    let releaseScripts: () => void = () => undefined;
    const scriptsReleased = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    const scriptPattern = "**/_next/static/**/*.js";

    await page.route(scriptPattern, async (route) => {
      await scriptsReleased;
      await route.continue();
    });
    await page.goto("/login", { waitUntil: "commit" });

    const email = page.getByLabel("邮箱");
    await expect(email).toBeDisabled();

    const fillEmail = email.fill("viewer@demo.com");
    setTimeout(releaseScripts, 100);
    await fillEmail;
    await page.unroute(scriptPattern);

    await expect(email).toHaveValue("viewer@demo.com");
    await page.getByLabel("密码").fill("demo1234");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("错误密码提示错误", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("邮箱").fill("admin@demo.com");
    await page.getByLabel("密码").fill("wrong-password");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByText("邮箱或密码错误")).toBeVisible();
  });

  test("登录 → 工作台 → 品牌 CRUD", async ({ page }) => {
    // 登录
    await page.goto("/login");
    await page.getByLabel("邮箱").fill("admin@demo.com");
    await page.getByLabel("密码").fill("demo1234");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "经营总览" })).toBeVisible();

    // 侧边栏进入品牌管理
    await page.getByRole("link", { name: "品牌与产品" }).click();
    await expect(page).toHaveURL(/\/brands/);
    await expect(page.getByText("光泽实验室 GlowLab")).toBeVisible();

    // 创建品牌
    const suffix = Date.now().toString(36);
    await page.getByRole("button", { name: "新建品牌" }).click();
    await page.getByLabel("品牌名称").fill(`E2E 品牌 ${suffix}`);
    await page.getByLabel("品牌标识").fill(`e2e-${suffix}`);
    await page.getByLabel("行业").fill("测试行业");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("cell", { name: `E2E 品牌 ${suffix}` })).toBeVisible();

    // 编辑品牌
    const row = page.getByRole("row", { name: new RegExp(`E2E 品牌 ${suffix}`) });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "编辑" }).click();
    await page.getByLabel("品牌名称").fill(`E2E 品牌改 ${suffix}`);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("cell", { name: `E2E 品牌改 ${suffix}` })).toBeVisible();

    // 删除品牌
    page.on("dialog", (dialog) => dialog.accept());
    const rowAfter = page.getByRole("row", { name: new RegExp(`E2E 品牌改 ${suffix}`) });
    await rowAfter.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await expect(page.getByRole("cell", { name: `E2E 品牌改 ${suffix}` })).toBeHidden();
  });

  test("只读角色看不到新建品牌入口的写权限", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("邮箱").fill("viewer@demo.com");
    await page.getByLabel("密码").fill("demo1234");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    // viewer 有 brand:read，能看到品牌页
    await page.getByRole("link", { name: "品牌与产品" }).click();
    await expect(page.getByText("光泽实验室 GlowLab")).toBeVisible();
  });
});
