import { expect, test, type Page } from "@playwright/test";

// 冒烟 #7：内容审核 + 数据分析
// 前置：pnpm seed；dev + worker（MODEL_PROVIDER=fake）运行中

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("admin@demo.com");
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function approveFirst(page: Page, titlePattern: RegExp) {
  await page.goto("/approvals");
  const card = page.locator("div").filter({ hasText: titlePattern }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "批准" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "批准" }).click();
  await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 10_000 });
}

test.describe("W7 内容审核与数据分析", () => {
  test("内容审核工作台：触发 AI 审核 → 审批通过 → 内容过审", async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);

    await page.goto("/content-review");
    await expect(page.getByText("林小鹿 28 天焕亮实测初稿")).toBeVisible({ timeout: 15_000 });
    await page.getByText("林小鹿 28 天焕亮实测初稿").click();
    // 演示库可能保留上次异常中断的运行：先通过产品恢复入口取消，再重新发起。
    const cancelButton = page.getByRole("button", { name: "取消本次审核" });
    if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelButton.click();
      await page.getByRole("dialog").getByRole("button", { name: "确认取消" }).click();
      await expect(page.getByRole("button", { name: /发起 AI 审核/ })).toBeVisible({
        timeout: 15_000,
      });
    }
    const startButton = page.getByRole("button", { name: /发起 AI 审核/ });
    if (await startButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startButton.click();
    }
    await expect(page.getByText(/医疗功效暗示|禁用词/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "批准" })).toBeVisible({ timeout: 30_000 });

    await approveFirst(page, /内容审核复核/);

    await page.goto("/content-review");
    await page.getByText("林小鹿 28 天焕亮实测初稿").click();
    await expect(page.getByText("已过审").first()).toBeVisible({ timeout: 30_000 });
  });

  test("分析页展示 KPI、趋势图和 AI Insights", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/analytics");
    await expect(page.getByText("曝光").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("趋势")).toBeVisible();
    await expect(page.getByText("AI Insights")).toBeVisible();
    await expect(page.getByText(/缓解措施：|建议负责人：/).first()).toBeVisible();
  });

  test("已导出报告保持只读，不能事后修改", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/reports?status=exported");

    await expect(page.getByText("已导出").first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("这是已冻结的正式报告。如需调整，请重新生成报告并完成审批。"),
    ).toBeVisible();
    await expect(page.getByLabel("标题")).toBeDisabled();
    await expect(page.getByRole("button", { name: "保存" })).toHaveCount(0);
  });
});
