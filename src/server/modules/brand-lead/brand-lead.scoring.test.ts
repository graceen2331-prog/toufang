import { describe, expect, it } from "vitest";
import { scoreBrandLead } from "./brand-lead.scoring";

describe("scoreBrandLead", () => {
  it("把热门品类和融资需求识别为优先机会", () => {
    const result = scoreBrandLead({
      productCategories: ["Artificial Intelligence", "Robotics", "Smart Home & Appliances"],
      country: "United States",
      description: "一段足够完整的品牌描述，用于说明产品场景、市场需求、内容合作空间和展会发布节奏。",
      website: "https://example.com",
      seekFunding: "Yes",
      fundingAmount: "$2M - $15M",
      revenue: "$1M - $5M",
      investmentStage: "Series A",
    });

    expect(result.score).toBeGreaterThanOrEqual(72);
    expect(result.tier).toBe("priority");
    expect(result.outreachSignals.some((signal) => signal.includes("正在寻求融资"))).toBe(true);
  });

  it("缺少融资和热门品类时保持观察层级", () => {
    const result = scoreBrandLead({
      productCategories: ["Accessories"],
      country: null,
      description: "配件品牌",
      website: null,
      seekFunding: "No",
      fundingAmount: null,
      revenue: null,
      investmentStage: null,
    });

    expect(result.tier).toBe("watch");
    expect(result.score).toBeLessThan(52);
  });
});
