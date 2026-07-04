// Seed v3：演示 Campaign（含达人管道 / 任务 / 预算 / 状态历史 / 审批项）
import type { PrismaClient } from "../src/generated/prisma/client";

export async function seedCampaigns(
  prisma: PrismaClient,
  tenantId: string,
  createdBy: string,
): Promise<void> {
  const existing = await prisma.campaign.count({ where: { tenantId, deletedAt: null } });
  if (existing > 0) {
    console.log(`[seed] Campaign 数据已存在（${existing} 个），跳过`);
    return;
  }

  const glowlab = await prisma.brand.findFirst({
    where: { tenantId, slug: "glowlab", deletedAt: null },
  });
  const aurora = await prisma.brand.findFirst({
    where: { tenantId, slug: "aurora-sports", deletedAt: null },
  });
  const vcSerum = await prisma.product.findFirst({
    where: { tenantId, name: "焕亮维C精华", deletedAt: null },
  });
  if (!glowlab || !aurora) return;

  // ---- Campaign 1：进行中（外联阶段） ----
  const c1 = await prisma.campaign.create({
    data: {
      tenantId,
      brandId: glowlab.id,
      productId: vcSerum?.id ?? null,
      name: "焕亮维C精华 双十一种草战役",
      objective: "conversion",
      status: "outreach",
      healthStatus: "on_track",
      markets: ["中国大陆"],
      platforms: ["douyin", "xiaohongshu"],
      budgetTotalCents: 50_000_000, // ¥50 万
      currency: "CNY",
      goals: { impressions: 20_000_000, engagement: 800_000, conversions: 15_000, roi: 2.5 },
      startDate: new Date("2026-09-15"),
      endDate: new Date("2026-11-15"),
      ownerId: createdBy,
      createdBy,
    },
  });
  // 状态历史（走过的阶段）
  const c1Path = ["draft", "strategy", "research", "creator_discovery", "shortlisting", "brief_creation", "outreach"];
  for (let i = 0; i < c1Path.length; i++) {
    await prisma.statusEvent.create({
      data: {
        tenantId,
        entityType: "campaign",
        entityId: c1.id,
        fromValue: i === 0 ? null : c1Path[i - 1]!,
        toValue: c1Path[i]!,
        actorType: i < 2 ? "user" : "system",
        actorId: i < 2 ? createdBy : null,
        createdAt: new Date(Date.now() - (c1Path.length - i) * 3 * 86400_000),
      },
    });
  }

  // 挂 8 位达人到不同阶段
  const creators = await prisma.creator.findMany({
    where: { tenantId, deletedAt: null, relationshipStatus: { notIn: ["blacklisted", "archived"] } },
    take: 8,
    orderBy: { createdAt: "asc" },
  });
  const ccStatuses = [
    { status: "contacted", contentStatus: "none" },
    { status: "contacted", contentStatus: "none" },
    { status: "replied", contentStatus: "none" },
    { status: "negotiating", contentStatus: "none" },
    { status: "confirmed", contentStatus: "briefed", contractStatus: "in_review" },
    { status: "active", contentStatus: "in_production", contractStatus: "signed", paymentStatus: "pending" },
    { status: "shortlisted", contentStatus: "none" },
    { status: "candidate", contentStatus: "none" },
  ];
  for (let i = 0; i < Math.min(creators.length, ccStatuses.length); i++) {
    const s = ccStatuses[i]!;
    await prisma.campaignCreator.create({
      data: {
        tenantId,
        campaignId: c1.id,
        creatorId: creators[i]!.id,
        status: s.status,
        contractStatus: s.contractStatus ?? "none",
        paymentStatus: s.paymentStatus ?? "none",
        contentStatus: s.contentStatus,
        role: i < 2 ? "hero" : i < 5 ? "amplifier" : "seeder",
        quotedPriceCents: (i + 3) * 500_000,
        agreedPriceCents: ["confirmed", "active"].includes(s.status) ? (i + 3) * 450_000 : null,
        matchScore: Math.round((0.6 + i * 0.04) * 100) / 100,
        aiGenerated: i < 5,
        createdBy,
      },
    });
  }

  // 任务
  await prisma.campaignTask.createMany({
    data: [
      { tenantId, campaignId: c1.id, title: "确认双十一档期排期表", status: "in_progress", priority: "high", assigneeId: createdBy, dueAt: new Date(Date.now() + 3 * 86400_000), createdBy },
      { tenantId, campaignId: c1.id, title: "收集已确认达人的收件信息", status: "todo", priority: "normal", createdBy },
      { tenantId, campaignId: c1.id, title: "完成 Brief 法务复核", status: "done", priority: "urgent", createdBy },
    ],
  });

  // 预算项
  await prisma.campaignBudgetItem.createMany({
    data: [
      { tenantId, campaignId: c1.id, category: "creator_fee", name: "头部达人合作费", plannedCents: 30_000_000, reservedCents: 9_000_000, spentCents: 0, currency: "CNY", createdBy },
      { tenantId, campaignId: c1.id, category: "creator_fee", name: "腰部达人合作费", plannedCents: 12_000_000, reservedCents: 4_500_000, spentCents: 0, currency: "CNY", createdBy },
      { tenantId, campaignId: c1.id, category: "production", name: "样品与物流", plannedCents: 2_000_000, reservedCents: 0, spentCents: 800_000, currency: "CNY", createdBy },
      { tenantId, campaignId: c1.id, category: "media", name: "优质内容投流放大", plannedCents: 6_000_000, reservedCents: 0, spentCents: 0, currency: "CNY", createdBy },
    ],
  });

  // ---- Campaign 2：草稿 ----
  await prisma.campaign.create({
    data: {
      tenantId,
      brandId: aurora.id,
      name: "UT-1 跑鞋城市轻越野首发",
      objective: "launch",
      status: "draft",
      markets: ["中国大陆"],
      platforms: ["bilibili", "douyin"],
      budgetTotalCents: 20_000_000,
      currency: "CNY",
      goals: { impressions: 8_000_000, engagement: 300_000 },
      ownerId: createdBy,
      createdBy,
    },
  });

  // ---- 审批项（演示审批中心） ----
  await prisma.humanCheckpoint.createMany({
    data: [
      {
        tenantId,
        type: "budget",
        status: "pending",
        title: "双十一战役预算调整：头部达人费用上调 ¥3 万",
        summary: "「林小鹿日记」报价高于预估，需上调头部达人预算项。",
        entityType: "campaign",
        entityId: c1.id,
        payload: { from_cents: 30_000_000, to_cents: 33_000_000, reason: "头部达人报价上浮" },
        priority: "high",
        assigneeRole: "manager",
        createdBy,
      },
      {
        tenantId,
        type: "shortlist",
        status: "approved",
        title: "双十一战役达人入围名单（8 人）",
        summary: "AI 推荐 12 人，人工筛选后确认 8 人进入执行管道。",
        entityType: "campaign",
        entityId: c1.id,
        payload: { candidates: 12, approved: 8 },
        priority: "normal",
        decidedBy: createdBy,
        decidedAt: new Date(Date.now() - 5 * 86400_000),
        decisionReason: "名单质量符合预期，两位高风险达人已剔除",
        createdBy,
      },
    ],
  });

  console.log("[seed] 已写入 2 个演示 Campaign（含达人管道/任务/预算/审批项）");
}
