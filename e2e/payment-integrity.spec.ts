import { expect, test, type Browser, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  const accountButton = page.getByRole("button", { name: new RegExp(email.replace(".", "\\.")) });
  if ((await accountButton.count()) > 0) {
    await accountButton.click();
  } else {
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("demo1234");
  }
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openContract(page: Page, contractNumber: string) {
  await page.goto(`/contracts?q=${encodeURIComponent(contractNumber)}`);
  const row = page.getByRole("row").filter({ hasText: contractNumber }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.getByRole("button", { name: "登记付款" })).toBeVisible({ timeout: 10_000 });
}

async function approveAsFinance(browser: Browser, approvalMarker: string) {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "zh-CN",
  });
  const page = await context.newPage();
  await login(page, "finance@demo.com");
  await page.goto("/approvals");
  const card = page.locator("[data-slot=card]").filter({ hasText: approvalMarker }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "批准" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("我已人工核对收款人、开户机构和账号末四位").click();
  await dialog.getByText("我已人工核对发票信息或免票依据").click();
  await dialog.getByPlaceholder("审批说明（至少 5 个字）").fill("已完成账户、发票与合同人工复核");
  await dialog.getByRole("button", { name: "确认授权" }).click();
  await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 15_000 });
  await context.close();
}

test("付款登记必须经过异人审批，并用对账证据完成付款", async ({ page, browser }) => {
  const suffix = Date.now().toString(36);
  await login(page, "admin@demo.com");
  const response = await page.request.get("/api/v1/contracts?status=signed&limit=100");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    data: Array<{
      contract_number: string;
      creator_name: string;
      amount_cents: number;
      payment_total_cents: number;
    }>;
  };
  const contract = body.data.find(
    (item) => item.amount_cents - item.payment_total_cents >= 100,
  );
  expect(contract, "需要一份至少剩余 ¥1 可付金额的已签署合同").toBeTruthy();
  await openContract(page, contract!.contract_number);
  await page.getByRole("button", { name: "登记付款" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.locator("input").nth(0).fill("1");
  await dialog.locator("input").nth(1).fill(contract!.creator_name);
  await dialog.locator("input").nth(2).fill("测试银行");
  await dialog.locator("input").nth(3).fill("622200001234");
  await dialog.locator("input").nth(4).fill(`FP-${suffix}`);
  await dialog.locator("input").nth(5).fill("付款验收开票方");
  await dialog.locator("textarea").fill("首期付款，等待财务复核。");
  await dialog.getByRole("button", { name: "登记付款" }).click();
  await expect(page.getByText("付款记录已创建")).toBeVisible({ timeout: 10_000 });

  let paymentRow = page.getByRole("row").filter({ hasText: "未开始" }).first();
  await paymentRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "待审批" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "提交审批" }).click();
  await expect(page.getByText("付款状态已更新")).toBeVisible({ timeout: 10_000 });

  await approveAsFinance(browser, `FP-${suffix}`);
  await openContract(page, contract!.contract_number);
  paymentRow = page.getByRole("row").filter({ hasText: "已批准" }).first();
  await expect(paymentRow).toBeVisible({ timeout: 15_000 });
  await paymentRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "登记付款与对账" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator("input").nth(0).fill(`BANK-${suffix}`);
  await dialog.getByPlaceholder(/至少 10 个字/).fill("已核对网银回单金额和收款账户末四位");
  await dialog.locator("input").nth(2).fill("receipt://payment-integrity-e2e");
  await dialog.getByRole("button", { name: "确认登记" }).click();
  await expect(page.getByText("付款与对账证据已登记")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("row").filter({ hasText: "已付款" }).first()).toBeVisible();
});
