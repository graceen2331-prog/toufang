import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasInfra = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasInfra)("品牌线索转换（集成）", () => {
  let prisma: (typeof import("@/server/db/client"))["prisma"];
  let service: typeof import("./brand-lead.service");
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db/client"));
    service = await import("./brand-lead.service");
    const suffix = Date.now();
    const org = await prisma.organization.create({
      data: { name: "品牌线索转换测试组织", slug: `brand-lead-conversion-${suffix}` },
    });
    orgId = org.id;
    const user = await prisma.user.create({
      data: {
        email: `brand-lead-conversion-${suffix}@test.dev`,
        name: "商机测试员",
        passwordHash: "x",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createLead(sourceId: string) {
    return prisma.brandLead.create({
      data: {
        tenantId: orgId,
        source: "integration",
        sourceId,
        name: "Orbit Labs",
        nameZh: "Orbit Labs 智能科技",
        country: "Singapore",
        campaignAngles: ["新品体验"],
        createdBy: userId,
      },
    });
  }

  function input() {
    return {
      existing_brand_id: null,
      brand_name: "Orbit Labs 智能科技",
      brand_description: "来源建议，已经人工确认",
      campaign_name: "Orbit Labs 新品合作",
      objective: "launch" as const,
      markets: ["Singapore"],
      platforms: ["xiaohongshu"],
      creative_direction: "新品体验",
    };
  }

  it("首次转换原子创建品牌、Campaign 与初始状态事件，重复请求返回原结果", async () => {
    const lead = await createLead(`first-${Date.now()}`);
    const ctx = { orgId, userId };

    const first = await service.convertBrandLead(ctx, lead.id, input());
    const repeated = await service.convertBrandLead(ctx, lead.id, input());

    expect(first.already_converted).toBe(false);
    expect(repeated).toMatchObject({
      campaign_id: first.campaign_id,
      brand_id: first.brand_id,
      already_converted: true,
    });
    expect(
      await prisma.statusEvent.count({
        where: { tenantId: orgId, entityType: "campaign", entityId: first.campaign_id },
      }),
    ).toBe(1);
    expect(await prisma.brandLead.findUnique({ where: { id: lead.id } })).toMatchObject({
      convertedCampaignId: first.campaign_id,
      convertedById: userId,
    });
  });

  it("并发重复转换只生成一个品牌和一个 Campaign", async () => {
    const lead = await createLead(`concurrent-${Date.now()}`);
    const ctx = { orgId, userId };
    const beforeBrands = await prisma.brand.count({ where: { tenantId: orgId } });
    const beforeCampaigns = await prisma.campaign.count({ where: { tenantId: orgId } });

    const [first, second] = await Promise.all([
      service.convertBrandLead(ctx, lead.id, input()),
      service.convertBrandLead(ctx, lead.id, input()),
    ]);

    expect(first.campaign_id).toBe(second.campaign_id);
    expect(await prisma.brand.count({ where: { tenantId: orgId } })).toBe(beforeBrands + 1);
    expect(await prisma.campaign.count({ where: { tenantId: orgId } })).toBe(beforeCampaigns + 1);
  });

  it("不能复用其他租户的品牌", async () => {
    const suffix = Date.now();
    const otherOrg = await prisma.organization.create({
      data: { name: "其他租户", slug: `brand-lead-other-${suffix}` },
    });
    const otherBrand = await prisma.brand.create({
      data: { tenantId: otherOrg.id, name: "其他品牌", slug: `other-${suffix}` },
    });
    const lead = await createLead(`isolation-${suffix}`);

    await expect(
      service.convertBrandLead({ orgId, userId }, lead.id, {
        ...input(),
        existing_brand_id: otherBrand.id,
        brand_name: null,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(await prisma.brandLead.findUnique({ where: { id: lead.id } })).toMatchObject({
      convertedCampaignId: null,
    });
  });
});
