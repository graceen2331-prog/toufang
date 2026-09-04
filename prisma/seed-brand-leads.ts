import type { PrismaClient } from "../src/generated/prisma/client";
import {
  generateChineseBrandName,
  generateChineseBrandProfile,
} from "../src/server/modules/brand-lead/brand-lead.localization";
import { scoreBrandLead } from "../src/server/modules/brand-lead/brand-lead.scoring";
import { normalizeExternalUrl } from "../src/shared/url";

const CES_LEADS = [
  {
    sourceId: "CES-DEMO-001",
    name: "Nova Robotics",
    website: "https://example.com/nova-robotics",
    country: "United States",
    description:
      "面向家庭与轻商业场景的服务机器人公司，CES 2026 展示新一代视觉导航与 AI 任务编排能力。",
    productCategories: ["Robotics", "Artificial Intelligence", "Smart Home & Appliances"],
    boothVenue: "Venetian Expo, Hall G",
    boothNumber: "61213",
    boothFull: "Venetian Expo, Hall G - 61213",
    seekFunding: "Yes",
    fundingAmount: "$2M - $15M",
    revenue: "$1M - $5M",
    investmentStage: "Series A",
  },
  {
    sourceId: "CES-DEMO-002",
    name: "LumaCare Health",
    website: "https://example.com/lumacare",
    country: "South Korea",
    description:
      "可穿戴健康监测硬件品牌，主打睡眠、心率与家庭慢病管理场景，正在寻找北美与亚洲市场合作伙伴。",
    productCategories: ["Digital Health", "Wearables", "Artificial Intelligence"],
    boothVenue: "Venetian Expo, Halls A-D",
    boothNumber: "52340",
    boothFull: "Venetian Expo, Halls A-D - 52340",
    seekFunding: "Yes",
    fundingAmount: "$250K - $2M",
    revenue: "< $1M",
    investmentStage: "Seed",
  },
  {
    sourceId: "CES-DEMO-003",
    name: "HomePulse AI",
    website: "https://example.com/homepulse",
    country: "China",
    description: "智能家居中控与 IoT 传感器品牌，提供家庭能源管理、安防联动和语音自动化解决方案。",
    productCategories: ["Smart Home & Appliances", "IoT/Sensors", "Artificial Intelligence"],
    boothVenue: "LVCC, Central Hall",
    boothNumber: "18821",
    boothFull: "LVCC, Central Hall - 18821",
    seekFunding: "No",
    fundingAmount: null,
    revenue: "$5M - $25M",
    investmentStage: null,
  },
  {
    sourceId: "CES-DEMO-004",
    name: "VoltWay Mobility",
    website: "https://example.com/voltway",
    country: "France",
    description: "电动微出行与车载交互系统公司，CES 期间重点展示城市短途通勤和车队管理方案。",
    productCategories: ["Vehicle Tech & Advanced Mobility", "Sustainability", "Startups"],
    boothVenue: "LVCC, West Hall",
    boothNumber: "42109",
    boothFull: "LVCC, West Hall - 42109",
    seekFunding: "Yes",
    fundingAmount: "$15M - $50M",
    revenue: "$1M - $5M",
    investmentStage: "Series B",
  },
  {
    sourceId: "CES-DEMO-005",
    name: "PixelNest Studio",
    website: "https://example.com/pixelnest",
    country: "Taiwan",
    description:
      "创作者硬件与直播配件品牌，产品覆盖桌面灯光、无线麦克风、移动拍摄支架和跨平台内容工作流。",
    productCategories: ["Accessories", "Content Creation", "Entertainment"],
    boothVenue: "LVCC, South Hall 2",
    boothNumber: "35207",
    boothFull: "LVCC, South Hall 2 - 35207",
    seekFunding: "Not specified",
    fundingAmount: null,
    revenue: "$5M - $25M",
    investmentStage: null,
  },
  {
    sourceId: "CES-DEMO-006",
    name: "AquaSense Labs",
    website: "https://example.com/aquasense",
    country: "Turkey",
    description:
      "用 AI 传感器监测家庭与商业空间用水质量的硬件创业公司，关注健康、可持续与物业管理场景。",
    productCategories: ["IoT/Sensors", "Sustainability", "Startups"],
    boothVenue: "Venetian Expo, Hall G",
    boothNumber: "60518",
    boothFull: "Venetian Expo, Hall G - 60518",
    seekFunding: "Yes",
    fundingAmount: "$250K - $2M",
    revenue: "< $1M",
    investmentStage: "Pre-seed",
  },
];

export async function seedBrandLeads(prisma: PrismaClient, tenantId: string, createdBy: string) {
  const importedCount = await prisma.brandLead.count({
    where: {
      tenantId,
      source: "ces_2026",
      deletedAt: null,
      NOT: { sourceId: { startsWith: "CES-DEMO" } },
    },
  });
  if (importedCount > 0) {
    console.log(`[seed] CES 全量品牌线索已存在（${importedCount} 条），跳过 6 条 demo seed`);
    return;
  }

  for (const lead of CES_LEADS) {
    const website = normalizeExternalUrl(lead.website);
    const scoring = scoreBrandLead({
      productCategories: lead.productCategories,
      country: lead.country,
      description: lead.description,
      website,
      seekFunding: lead.seekFunding,
      fundingAmount: lead.fundingAmount,
      revenue: lead.revenue,
      investmentStage: lead.investmentStage,
    });
    const nameZh = generateChineseBrandName({
      name: lead.name,
      categories: lead.productCategories,
    });
    const brandProfileZh = generateChineseBrandProfile({
      name: lead.name,
      nameZh,
      country: lead.country,
      categories: lead.productCategories,
      description: lead.description,
      boothFull: lead.boothFull,
      seekFunding: lead.seekFunding,
      fundingAmount: lead.fundingAmount,
      investmentStage: lead.investmentStage,
      campaignAngles: scoring.campaignAngles,
      outreachSignals: scoring.outreachSignals,
    });

    await prisma.brandLead.upsert({
      where: {
        tenantId_source_sourceId: {
          tenantId,
          source: "ces_2026",
          sourceId: lead.sourceId,
        },
      },
      update: {
        name: lead.name,
        nameZh,
        website,
        country: lead.country,
        description: lead.description,
        brandProfileZh,
        productCategories: lead.productCategories,
        boothVenue: lead.boothVenue,
        boothNumber: lead.boothNumber,
        boothFull: lead.boothFull,
        seekFunding: lead.seekFunding,
        fundingAmount: lead.fundingAmount,
        revenue: lead.revenue,
        investmentStage: lead.investmentStage,
        opportunityScore: scoring.score,
        opportunityTier: scoring.tier,
        recommendedCreatorProfile: scoring.recommendedCreatorProfile,
        campaignAngles: scoring.campaignAngles,
        outreachSignals: scoring.outreachSignals,
        rawData: { source: "CES 2026 Exhibitor Database demo subset" },
        updatedBy: createdBy,
      },
      create: {
        tenantId,
        source: "ces_2026",
        sourceId: lead.sourceId,
        name: lead.name,
        nameZh,
        website,
        country: lead.country,
        description: lead.description,
        brandProfileZh,
        productCategories: lead.productCategories,
        boothVenue: lead.boothVenue,
        boothNumber: lead.boothNumber,
        boothFull: lead.boothFull,
        seekFunding: lead.seekFunding,
        fundingAmount: lead.fundingAmount,
        revenue: lead.revenue,
        investmentStage: lead.investmentStage,
        opportunityScore: scoring.score,
        opportunityTier: scoring.tier,
        recommendedCreatorProfile: scoring.recommendedCreatorProfile,
        campaignAngles: scoring.campaignAngles,
        outreachSignals: scoring.outreachSignals,
        rawData: { source: "CES 2026 Exhibitor Database demo subset" },
        createdBy,
      },
    });
  }
}
