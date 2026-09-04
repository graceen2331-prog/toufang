import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function dashboardRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/v1/")) requests.push(pathname);
  });
  return requests;
}

test.describe("角色化工作台", () => {
  test("管理员看到经营总览与完整经营数据", async ({ page }) => {
    const requests = dashboardRequests(page);
    await login(page, "admin@demo.com");

    await expect(page.getByRole("heading", { level: 1, name: "经营总览" })).toBeVisible();
    await expect(page.getByText("管理员工作台")).toBeVisible();
    await expect(page.getByText("总曝光")).toBeVisible();
    await expect(page.getByRole("link", { name: "新建 Campaign" })).toBeVisible();
    await expect(page.getByText("近期 Campaign 健康度")).toBeVisible();

    expect(requests).toContain("/api/v1/metrics");
    expect(requests).toContain("/api/v1/campaigns");
    expect(requests).toContain("/api/v1/approvals");
    expect(requests).toContain("/api/v1/reports");
  });

  test("达人运营只加载推进工作需要的数据", async ({ page }) => {
    const requests = dashboardRequests(page);
    await login(page, "kol@demo.com");

    await expect(page.getByRole("heading", { level: 1, name: "达人推进台" })).toBeVisible();
    await expect(page.getByText("待推进会话")).toBeVisible();
    await expect(page.getByText("谈判中")).toBeVisible();
    await expect(page.getByText("总曝光")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "新建 Campaign" })).toHaveCount(0);

    expect(requests).toContain("/api/v1/outreach");
    expect(requests).toContain("/api/v1/campaigns");
    expect(requests).toContain("/api/v1/contracts");
    expect(requests).not.toContain("/api/v1/metrics");
    expect(requests).not.toContain("/api/v1/reports");
  });

  test("财务角色聚焦合同与资金，不加载营销面板", async ({ page }) => {
    const requests = dashboardRequests(page);
    await login(page, "finance@demo.com");

    await expect(page.getByRole("heading", { level: 1, name: "合同与资金台" })).toBeVisible();
    await expect(page.getByText("近期待付金额")).toBeVisible();
    await expect(page.getByText("近期 Campaign 健康度")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "新建 Campaign" })).toHaveCount(0);

    expect(requests).toContain("/api/v1/contracts");
    expect(requests).toContain("/api/v1/approvals");
    expect(requests).toContain("/api/v1/reports");
    expect(requests).not.toContain("/api/v1/metrics");
    expect(requests).not.toContain("/api/v1/campaigns");
  });

  test("只读角色只显示授权摘要且没有写入口", async ({ page }) => {
    const requests = dashboardRequests(page);
    await login(page, "viewer@demo.com");

    await expect(page.getByRole("heading", { level: 1, name: "业务观察台" })).toBeVisible();
    await expect(page.getByText("只读工作台")).toBeVisible();
    await expect(page.getByText("总曝光")).toBeVisible();
    await expect(page.getByRole("link", { name: "新建 Campaign" })).toHaveCount(0);

    expect(requests).toContain("/api/v1/metrics");
    expect(requests).toContain("/api/v1/campaigns");
    expect(requests).toContain("/api/v1/reports");
    expect(requests).not.toContain("/api/v1/approvals");
    expect(requests).not.toContain("/api/v1/contracts");
  });
});
