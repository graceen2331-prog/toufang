import { describe, expect, it } from "vitest";
import { createConvertedBrandSlug } from "./brand-lead.service";

describe("品牌线索转换", () => {
  it("为英文品牌生成稳定且合法的 slug", () => {
    const slug = createConvertedBrandSlug("Zeta Mobility Inc.", "0199-abcd-1234-5678");
    expect(slug).toBe("zeta-mobility-inc-12345678");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(createConvertedBrandSlug("Zeta Mobility Inc.", "0199-abcd-1234-5678")).toBe(slug);
  });

  it("中文名称回退为 brand，并保留线索稳定后缀", () => {
    expect(createConvertedBrandSlug("星河智能", "0199-abcd-1234-5678")).toBe("brand-12345678");
  });
});
