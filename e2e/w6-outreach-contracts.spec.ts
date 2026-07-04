import { expect, test, type Page } from "@playwright/test";

// 冒烟 #6：外联/谈判/合同（对应 W6 验收）
// 前置：dev（MODEL_PROVIDER=fake）+ 已 seed（含 W6 外联/合同演示数据）运行中
// 说明：外联 AI 起草/谈判分析走 runAgent 同步执行，不依赖 worker。

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("admin@demo.com");
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("外联 / 谈判 / 合同", () => {
  test("外联工作台：会话可见 → AI 起草 → 提交审批门 → 审批中心批准 → 标记已发送", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);

    // 列表可见（seed 提供 6 个会话）
    await page.goto("/outreach");
    await expect(page.getByRole("heading", { name: "外联工作台" })).toBeVisible();
    const firstRow = page.getByRole("row").nth(1);
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/outreach\/[0-9a-f-]+/, { timeout: 10_000 });

    // AI 起草 → 生成草稿（fake provider 同步返回）
    await page.getByRole("button", { name: "AI 起草" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "生成草稿" }).click();
    await expect(page.getByText("AI 外联草稿已生成")).toBeVisible({ timeout: 30_000 });

    // 找到刚生成的草稿卡片（唯一处于「草稿」态的消息），提交审批
    const draftCard = page
      .locator("[data-slot=card]")
      .filter({ hasText: "草稿" })
      .filter({ hasText: "AI 生成" })
      .first();
    await expect(draftCard).toBeVisible({ timeout: 10_000 });
    await draftCard.getByRole("button").last().click(); // 状态菜单触发器
    await page.getByRole("menuitem", { name: "待审批" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "提交审批" }).click();
    await expect(page.getByText("消息状态已更新")).toBeVisible({ timeout: 10_000 });

    // 审批中心批准这条外联发送审批
    await page.goto("/approvals");
    const approvalCard = page
      .locator("div")
      .filter({ hasText: /外联消息发送审批/ })
      .first();
    await expect(approvalCard).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "批准" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "批准" }).click();
    await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 10_000 });
  });

  test("合同与付款：列表可见 → 打开详情 → 付款记录区可见", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/contracts");
    await expect(page.getByRole("heading", { name: "合同与付款" })).toBeVisible();

    const firstRow = page.getByRole("row").nth(1);
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    // 右侧详情面板
    await expect(page.getByText("合同金额").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("付款记录").first()).toBeVisible();
  });
});
