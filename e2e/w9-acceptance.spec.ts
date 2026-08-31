import { expect, test, type Browser, type Page } from "@playwright/test";

async function login(page: Page, email = "admin@demo.com") {
  await page.goto("/login");
  const accountButton = page.getByRole("button", {
    name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  });
  if ((await accountButton.count()) > 0) {
    await accountButton.click();
  } else {
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("demo1234");
  }
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

async function approveFirst(page: Page, titlePattern: RegExp, timeout = 45_000) {
  await page.goto("/approvals");
  const card = page.locator("[data-slot=card]").filter({ hasText: titlePattern }).first();
  await expect(card).toBeVisible({ timeout });
  await card.getByRole("button", { name: "批准" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "批准" }).click();
  await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 15_000 });
}

async function waitForWorkflowApproval(page: Page) {
  await expect(page.getByText(/工作流已暂停.*(待办栏|等待人工审批)/)).toBeVisible({
    timeout: 45_000,
  });
}

async function approveInlineFromCampaign(page: Page, titlePattern: RegExp, timeout = 45_000) {
  const rail = page.locator("aside").filter({ hasText: "当前 Campaign 待办" }).first();
  await expect(rail).toBeVisible({ timeout: 10_000 });
  const card = rail.locator("article").filter({ hasText: titlePattern }).first();
  await expect(card).toBeVisible({ timeout });
  await card.getByRole("button", { name: "批准" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "批准" }).click();
  await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]+/);
}

async function runCampaignWorkflow(page: Page, buttonIndex: number, approvalTitle: RegExp) {
  await page.getByRole("tab", { name: "达人 Pipeline" }).click();
  await page.getByRole("button", { name: "运行" }).nth(buttonIndex).click();
  await waitForWorkflowApproval(page);
  await approveFirst(page, approvalTitle);
}

async function transitionBrief(page: Page, targetLabel: string) {
  const briefPanel = page.getByLabel("Brief");
  await briefPanel.getByRole("button", { name: "推进状态" }).click();
  await page.getByRole("menuitem", { name: targetLabel }).click();
  await expect(page.getByText("Brief 状态已更新")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(targetLabel).first()).toBeVisible({ timeout: 10_000 });
}

async function advanceFirstCreator(
  page: Page,
  campaignUrl: string,
  currentLabel: string,
  targetLabel: string,
) {
  await page.goto(campaignUrl);
  await page.getByRole("tab", { name: "达人 Pipeline" }).click();
  const row = page.getByRole("row").filter({ hasText: currentLabel }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: "操作" }).click();
  await page.getByRole("menuitem", { name: targetLabel }).click();
  await expect(page.getByText("达人状态已更新")).toBeVisible({ timeout: 10_000 });
}

async function createOutreachThread(page: Page, campaignName: string): Promise<string> {
  await page.goto("/outreach");
  await page.getByRole("button", { name: "新建外联" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: new RegExp(campaignName) }).click();
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await dialog.locator("input").first().fill(`W9 ${campaignName} 外联`);
  await dialog.getByRole("button", { name: "创建" }).click();
  await expect(page.getByText("外联会话已创建")).toBeVisible({ timeout: 10_000 });

  const row = page.getByRole("row").filter({ hasText: campaignName }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page).toHaveURL(/\/outreach\/[0-9a-f-]+/, { timeout: 10_000 });
  return page.url();
}

async function completeOutreachAndNegotiation(page: Page, campaignName: string) {
  const threadUrl = await createOutreachThread(page, campaignName);

  await page.getByRole("button", { name: "AI 起草" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "生成草稿" }).click();
  await expect(page.getByText("AI 外联草稿已生成")).toBeVisible({ timeout: 30_000 });

  const draftCard = page
    .locator("[data-slot=card]")
    .filter({ hasText: "草稿" })
    .filter({ hasText: "AI 生成" })
    .first();
  await expect(draftCard).toBeVisible({ timeout: 15_000 });
  await draftCard.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "待审批" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "提交审批" }).click();
  await expect(page.getByText("消息状态已更新")).toBeVisible({ timeout: 10_000 });

  await approveFirst(page, /外联消息发送审批/);
  await page.goto(threadUrl);
  const approvedCard = page
    .locator("[data-slot=card]")
    .filter({ hasText: "已批准" })
    .filter({ hasText: "AI 生成" })
    .first();
  await expect(approvedCard).toBeVisible({ timeout: 15_000 });
  await approvedCard.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "已发送" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认推进" }).click();
  await expect(page.getByText("消息状态已更新")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "记录消息" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "达人回复" }).click();
  await dialog.locator("input").fill("合作报价与档期");
  await dialog.locator("textarea").fill("有兴趣参与，短视频报价 80000 元，档期可以配合预热期。");
  await dialog.getByRole("button", { name: "保存消息" }).click();
  await expect(page.getByText("消息已记录")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "分析最新回复" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator("input").fill("80000");
  await dialog.getByRole("button", { name: "生成分析" }).click();
  await expect(page.getByText("谈判分析已生成")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "确认合作条款" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator("input").nth(0).fill("65000");
  await dialog.locator("input").nth(1).fill("短视频 1 条、图文笔记 1 篇");
  await dialog.locator("textarea").nth(0).fill("品牌可在站内外复投 90 天。");
  await dialog.locator("textarea").nth(1).fill("合同签署后 7 个工作日内支付 50%。");
  await dialog.getByRole("button", { name: "确认条款" }).click();
  await expect(page.getByText("合作条款已确认")).toBeVisible({ timeout: 10_000 });
}

async function createContractAndPayment(page: Page, campaignName: string) {
  await page.goto("/contracts");
  await page.getByRole("button", { name: "新建合同" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: new RegExp(campaignName) }).click();
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await dialog.locator("input").fill("65000");
  await dialog.locator("textarea").nth(0).fill("短视频与图文素材可复投 90 天。");
  await dialog.locator("textarea").nth(1).fill("同品类精华 30 天排他。");
  await dialog.locator("textarea").nth(2).fill("合同发送后按节点付款。");
  await dialog.getByRole("button", { name: "创建合同" }).click();
  await expect(page.getByText("合同已创建")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "推进合同状态" }).click();
  await page.getByRole("menuitem", { name: "审核中" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "提交审批" }).click();
  await expect(page.getByText("合同状态已更新")).toBeVisible({ timeout: 10_000 });
  await approveFirst(page, /合同审批/);

  await page.goto("/contracts");
  const row = page.getByRole("row").filter({ hasText: campaignName }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  await expect(page.getByText("已发送").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "推进合同状态" }).click();
  await page.getByRole("menuitem", { name: "已签署" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "确认推进" }).click();
  await expect(page.getByText("合同状态已更新")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("已签署").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "登记付款" }).click();
  dialog = page.getByRole("dialog");
  await dialog.locator("input").fill("30000");
  await dialog.locator("textarea").fill("首付款登记。");
  await dialog.getByRole("button", { name: "登记付款" }).click();
  await expect(page.getByText("付款记录已创建")).toBeVisible({ timeout: 10_000 });

  const paymentRow = page.getByRole("row").filter({ hasText: "未开始" }).first();
  await expect(paymentRow).toBeVisible({ timeout: 10_000 });
  await paymentRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "待审批" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "提交审批" }).click();
  await expect(page.getByText("付款状态已更新")).toBeVisible({ timeout: 10_000 });
  await approveFirst(page, /付款审批/);
}

async function submitReviewPublishAndMetric(
  page: Page,
  campaignName: string,
  contentTitle: string,
) {
  await page.goto("/content-review");
  await page.getByRole("button", { name: "提交内容" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: new RegExp(campaignName) }).click();
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("textbox").nth(0).fill(contentTitle);
  await dialog.getByRole("textbox").nth(1).fill("小红书");
  await dialog
    .getByPlaceholder("粘贴达人初稿文案，AI 审核会结合 Brief 与品牌禁用词检查。")
    .fill("这支焕亮维C精华有医疗级焕亮体验，7 天治愈暗沉。点击购物车领取双十一专属优惠。");
  await dialog.getByRole("button", { name: "提交内容" }).click();
  await expect(page.getByText("内容已提交")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(contentTitle).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "发起 AI 审核" }).click();
  await expect(page.getByText("AI 内容审核已启动")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/医疗功效暗示|禁用词|高风险/).first()).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("button", { name: "批准" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "批准" }).click();
  await expect(page.getByText("已过审").first()).toBeVisible({ timeout: 45_000 });

  await page.getByRole("button", { name: "标记发布" }).click();
  await expect(page.getByText("内容状态已更新")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("已发布").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "录入指标" }).click();
  await expect(page.getByText("指标已录入")).toBeVisible({ timeout: 10_000 });
}

async function generateApproveAndExportReport(page: Page, campaignName: string) {
  await page.goto("/analytics");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: new RegExp(campaignName) }).click();
  await expect(page.getByText("曝光").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "生成 AI 分析" }).click();
  await expect(page.getByText("分析工作流已启动")).toBeVisible({ timeout: 10_000 });
  await approveFirst(page, /报告审批/, 60_000);

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "报告" })).toBeVisible();
  const reportRow = page
    .getByRole("row")
    .filter({ hasText: "焕亮维C精华 双十一种草阶段复盘" })
    .first();
  await expect(reportRow).toBeVisible({ timeout: 30_000 });
  await reportRow.click();
  await expect(page.getByText("高管摘要")).toBeVisible();
  await page.getByRole("button", { name: "导出" }).click();
  await expect(page.getByText("报告已标记导出")).toBeVisible({ timeout: 10_000 });
}

async function assertViewerDenied(browser: Browser) {
  const viewerContext = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "zh-CN",
  });
  const viewerPage = await viewerContext.newPage();
  await login(viewerPage, "viewer@demo.com");
  await viewerPage.goto("/admin/users");
  await expect(viewerPage.getByText("没有访问权限")).toBeVisible({ timeout: 15_000 });
  await viewerContext.close();
}

test.describe("W9 最终验收", () => {
  test("未知路径展示品牌化返回入口", async ({ page }) => {
    await login(page);
    await page.goto("/does-not-exist-product-readiness");
    await expect(page.getByRole("heading", { name: "这个页面不在当前工作区" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回工作台" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  test("Campaign 详情页内可直接处理当前 Campaign 审批", async ({ page }) => {
    test.slow();
    const suffix = Date.now().toString(36);
    const campaignName = `内联审批验收 ${suffix}`;

    await login(page);
    await createCampaign(page, campaignName);
    await expect(page.getByText("当前 Campaign 待办")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("tab", { name: "策略" }).click();
    await page.getByRole("button", { name: /AI 生成策略/ }).click();
    await waitForWorkflowApproval(page);
    await approveInlineFromCampaign(page, new RegExp(`策略草案审批：${campaignName}`));
  });

  test("端到端演示剧本：Campaign → AI → 外联合同 → 内容指标 → 报告与横切验证", async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);
    const suffix = Date.now().toString(36);
    const campaignName = `W9 验收战役 ${suffix}`;
    const contentTitle = `W9 内容初稿 ${suffix}`;

    await login(page);
    await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
    await expect(page.getByText("总曝光")).toBeVisible();
    await expect(page.getByRole("button", { name: /星澜传媒/ })).toBeVisible();

    const campaignUrl = await createCampaign(page, campaignName);

    await page.getByRole("tab", { name: "策略" }).click();
    await page.getByRole("button", { name: /AI 生成策略/ }).click();
    await waitForWorkflowApproval(page);
    await approveFirst(page, new RegExp(`策略草案审批：${campaignName}`));
    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "策略" }).click();
    await expect(page.getByText(/成分实证|策略 v/).first()).toBeVisible({ timeout: 30_000 });

    await runCampaignWorkflow(page, 1, new RegExp(`达人候选名单确认：${campaignName}`));
    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "达人 Pipeline" }).click();
    await expect(page.getByText("候选").first()).toBeVisible({ timeout: 20_000 });

    await runCampaignWorkflow(page, 2, new RegExp(`达人入围名单审批：${campaignName}`));
    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "达人 Pipeline" }).click();
    await expect(page.getByText("已入围").first()).toBeVisible({ timeout: 20_000 });
    await advanceFirstCreator(page, campaignUrl, "已入围", "已批准");

    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "Brief" }).click();
    await page.getByRole("button", { name: /AI 生成 Brief/ }).click();
    await waitForWorkflowApproval(page);
    await approveFirst(page, /Brief 审批/);
    await page.goto(campaignUrl);
    await page.getByRole("tab", { name: "Brief" }).click();
    await expect(page.getByText("焕亮维C精华 双十一种草 Brief")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "编辑" }).click();
    await page.getByLabel("标题").fill(`W9 定稿 Brief ${suffix}`);
    await page.getByRole("button", { name: /保存/ }).click();
    await expect(page.getByText("已保存新版本")).toBeVisible({ timeout: 10_000 });
    await transitionBrief(page, "审核中");
    await transitionBrief(page, "已批准");

    await completeOutreachAndNegotiation(page, campaignName);
    await createContractAndPayment(page, campaignName);
    await submitReviewPublishAndMetric(page, campaignName, contentTitle);
    await generateApproveAndExportReport(page, campaignName);

    await page.goto("/ai-runs");
    await expect(page.getByText("本月已用")).toBeVisible();
    await expect(page.getByText(/策略生成|效果分析/).first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/audit-logs");
    await page.getByPlaceholder("搜索 action").fill("metric.upsert");
    await expect(page.getByText("metric.upsert").first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/knowledge");
    await page
      .getByPlaceholder("例如：双十一美妆 Campaign 哪类内容更适合承接转化？")
      .fill("双十一美妆 Campaign 哪类内容更适合承接转化？");
    await page.getByRole("button", { name: "提问" }).click();
    await expect(page.getByText("引用来源")).toBeVisible({ timeout: 30_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/content-review");
    await expect(page.getByRole("heading", { name: "内容审核" })).toBeVisible();
    await page.goto("/approvals");
    await expect(page.getByRole("heading", { name: "审批中心" })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });

    await assertViewerDenied(browser);

    await page.getByRole("button", { name: /星澜传媒/ }).click();
    await page.getByRole("menuitem", { name: /北辰品牌部/ }).click();
    await expect(page.getByText("北辰品牌部")).toBeVisible({ timeout: 10_000 });
    await page.goto(`/campaigns?q=${encodeURIComponent(campaignName)}`);
    await expect(page.getByText("没有匹配的结果")).toBeVisible({ timeout: 15_000 });
  });
});
