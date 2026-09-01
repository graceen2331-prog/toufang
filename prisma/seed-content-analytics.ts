import type { PrismaClient } from "../src/generated/prisma/client";

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

async function ensureBrief(prisma: PrismaClient, tenantId: string, campaignId: string, createdBy: string) {
  let brief = await prisma.brief.findFirst({
    where: { tenantId, campaignId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!brief) {
    brief = await prisma.brief.create({
      data: {
        tenantId,
        campaignId,
        title: "焕亮维C精华 双十一种草 Brief",
        status: "approved",
        approvedAt: new Date(),
        approvedBy: createdBy,
        createdBy,
      },
    });
  }
  if (!brief.currentVersionId) {
    const version = await prisma.briefVersion.create({
      data: {
        tenantId,
        briefId: brief.id,
        version: 1,
        content: {
          title: "焕亮维C精华 双十一种草 Brief",
          must_include: ["产品全名", "核心成分与浓度", "双十一优惠 CTA"],
          must_avoid: ["最强", "第一", "治愈", "医疗级", "药用"],
          platform_requirements: [{ platform: "douyin", requirements: ["挂购物车", "添加指定话题"] }],
        },
        plainText:
          "必须包含产品全名、核心成分与浓度、双十一优惠 CTA。禁止出现最强、第一、治愈、医疗级、药用等表述。",
        changeSummary: "seed 内容审核演示 Brief",
        createdBy,
      },
    });
    brief = await prisma.brief.update({
      where: { id: brief.id },
      data: { currentVersionId: version.id, status: "approved", approvedAt: new Date(), approvedBy: createdBy },
    });
  }
  return brief;
}

async function ensureContentAsset(
  prisma: PrismaClient,
  tenantId: string,
  campaignCreatorId: string,
  briefId: string,
  createdBy: string,
  title: string,
  caption: string,
  status = "submitted",
) {
  const existing = await prisma.contentAsset.findFirst({
    where: { tenantId, campaignCreatorId, title, deletedAt: null },
  });
  if (existing) {
    return prisma.contentAsset.update({
      where: { id: existing.id },
      data: {
        briefId,
        status,
        contentType: "video",
        platform: "douyin",
        caption,
        transcript: caption,
        url: `https://example.com/content/${campaignCreatorId.slice(-12)}`,
        updatedBy: createdBy,
      },
    });
  }
  return prisma.contentAsset.create({
    data: {
      tenantId,
      campaignCreatorId,
      briefId,
      title,
      status,
      contentType: "video",
      platform: "douyin",
      caption,
      transcript: caption,
      url: `https://example.com/content/${campaignCreatorId.slice(-12)}`,
      createdBy,
    },
  });
}

async function upsertMetric(
  prisma: PrismaClient,
  tenantId: string,
  entityType: string,
  entityId: string,
  platform: string,
  metricDate: Date,
  metrics: Record<string, number>,
  createdBy: string,
) {
  await prisma.performanceMetric.upsert({
    where: {
      tenantId_entityType_entityId_platform_metricDate: {
        tenantId,
        entityType,
        entityId,
        platform,
        metricDate,
      },
    },
    update: { metrics, source: "import" },
    create: { tenantId, entityType, entityId, platform, metricDate, metrics, source: "import", createdBy },
  });
}

export async function seedContentAnalytics(
  prisma: PrismaClient,
  tenantId: string,
  createdBy: string,
): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { tenantId, name: "焕亮维C精华 双十一种草战役", deletedAt: null },
  });
  if (!campaign) return;

  const brief = await ensureBrief(prisma, tenantId, campaign.id, createdBy);
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { tenantId, campaignId: campaign.id, deletedAt: null, status: { in: ["confirmed", "active", "content_submitted"] } },
    include: { creator: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  if (campaignCreators.length === 0) return;

  const assets = [];
  const risky = await ensureContentAsset(
    prisma,
    tenantId,
    campaignCreators[0]!.id,
    brief.id,
    createdBy,
    "林小鹿 28 天焕亮实测初稿",
    "这支医疗级焕亮精华 7 天治愈暗沉，双十一一定要囤。核心成分是 15% VC 衍生物。",
  );
  assets.push(risky);

  if (campaignCreators[1]) {
    assets.push(
      await ensureContentAsset(
        prisma,
        tenantId,
        campaignCreators[1].id,
        brief.id,
        createdBy,
        "成分党维C精华温和提亮测评",
        "连续 28 天记录肤色变化，重点讲 15% VC 衍生物与烟酰胺搭配，结尾提醒点击购物车领取双十一优惠。",
        "approved",
      ),
    );
  }
  if (campaignCreators[2]) {
    assets.push(
      await ensureContentAsset(
        prisma,
        tenantId,
        campaignCreators[2].id,
        brief.id,
        createdBy,
        "双十一焕亮精华图文脚本",
        "图文围绕早八通勤场景讲温和提亮，避免绝对化表达，保留优惠 CTA。",
        "published",
      ),
    );
  }

  for (let i = 0; i < 35; i++) {
    const metricDate = daysAgo(34 - i);
    const growth = i + 1;
    await upsertMetric(prisma, tenantId, "campaign", campaign.id, "all", metricDate, {
      impressions: 20_000 + growth * 1800,
      views: 12_000 + growth * 1300,
      likes: 450 + growth * 38,
      comments: 60 + growth * 5,
      shares: 35 + growth * 4,
      clicks: 220 + growth * 18,
      conversions: i > 12 ? 12 + growth : 0,
      revenue_cents: i > 12 ? (12 + growth) * 28900 : 0,
      cost_cents: 80_000 + growth * 1000,
    }, createdBy);

    for (const [index, asset] of assets.entries()) {
      await upsertMetric(prisma, tenantId, "content_asset", asset.id, asset.platform ?? "douyin", metricDate, {
        views: 2800 + growth * (220 - index * 35),
        likes: 90 + growth * (8 - index),
        comments: 12 + growth,
        shares: 8 + growth,
        clicks: 35 + growth * (3 - index),
        conversions: i > 15 ? Math.max(0, 3 + growth - index * 2) : 0,
      }, createdBy);
    }
  }

  const insightDefs = [
    {
      kind: "anomaly",
      title: "评论区出现禁用词讨论",
      content: "高风险初稿中的医疗化表达可能引导评论区讨论功效边界，建议先完成内容修改再发布。",
      severity: "critical",
    },
    {
      kind: "opportunity",
      title: "成分实测内容观看稳定增长",
      content: "28 天记录类内容的观看与收藏更稳，适合复投为双十一预热主素材。",
      severity: "info",
    },
  ];
  for (const insight of insightDefs) {
    const existing = await prisma.insight.findFirst({ where: { tenantId, campaignId: campaign.id, title: insight.title, deletedAt: null } });
    if (!existing) {
      await prisma.insight.create({
        data: { tenantId, campaignId: campaign.id, ...insight, data: { seed: true }, aiGenerated: false },
      });
    }
  }

  const report = await prisma.report.findFirst({
    where: { tenantId, campaignId: campaign.id, title: "焕亮维C精华阶段复盘草稿", deletedAt: null },
  });
  if (!report) {
    const reportId = crypto.randomUUID();
    await prisma.report.create({
      data: {
        id: reportId,
        tenantId,
        seriesId: reportId,
        campaignId: campaign.id,
        title: "焕亮维C精华阶段复盘草稿",
        kind: "campaign_retro",
        status: "draft",
        content: {
          executive_summary: "成分实测内容带动曝光增长，但合规风险和转化归因仍需跟进。",
          narrative: "事实：内容观看量稳步增长。推断：CTA 露出不足可能影响点击转化。",
          key_learnings: ["成分实测适合作为信任背书", "禁用词需要在初稿阶段提前拦截"],
          recommendations: ["复投已过审高完播内容", "补齐订单回传后复算 ROI"],
          data_limitations: ["部分达人级收入归因滞后"],
          requires_approval: true,
        },
        aiGenerated: false,
        createdBy,
      },
    });
  }

  console.log("[seed] 已补齐 W7 内容审核/数据分析/报告演示数据");
}
