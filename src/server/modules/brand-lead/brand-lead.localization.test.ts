import { describe, expect, it } from "vitest";
import { generateChineseBrandName, generateChineseBrandProfile } from "./brand-lead.localization";

describe("brand lead localization", () => {
  it("为英文公司名生成中文参考名", () => {
    expect(
      generateChineseBrandName({
        name: "Zeta Mobility Inc.",
        categories: ["Vehicle Tech & Advanced Mobility", "Artificial Intelligence"],
      }),
    ).toBe("Zeta Mobility 出行科技");
  });

  it("公司名语义优先于宽泛品类", () => {
    expect(
      generateChineseBrandName({
        name: "Zeta Mobility",
        categories: ["Artificial Intelligence", "Digital Health", "IoT/Sensors"],
      }),
    ).toBe("Zeta Mobility 出行科技");
  });

  it("机器人品牌名优先于智能家居品类", () => {
    expect(
      generateChineseBrandName({
        name: "Nova Robotics",
        categories: ["Robotics", "Artificial Intelligence", "Smart Home & Appliances"],
      }),
    ).toBe("Nova Robotics 机器人");
  });

  it("为品牌画像生成中文描述", () => {
    const profile = generateChineseBrandProfile({
      name: "Zeta Mobility Inc.",
      nameZh: "Zeta Mobility 出行科技",
      country: "South Korea",
      categories: ["Vehicle Tech & Advanced Mobility"],
      description: "Autonomous mobility platform.",
      boothFull: "LVCC - 100",
      seekFunding: "Yes",
      fundingAmount: "$2M - $15M",
      investmentStage: "Series A",
      campaignAngles: ["未来出行体验"],
      outreachSignals: ["正在寻求融资"],
    });

    expect(profile).toContain("韩国");
    expect(profile).toContain("汽车科技与未来出行");
    expect(profile).toContain("未来出行体验");
  });
});
