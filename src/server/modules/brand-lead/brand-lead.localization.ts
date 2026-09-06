const COUNTRY_ZH: Record<string, string> = {
  "United States": "美国",
  China: "中国",
  "South Korea": "韩国",
  France: "法国",
  Taiwan: "中国台湾",
  Japan: "日本",
  Germany: "德国",
  Canada: "加拿大",
  Turkey: "土耳其",
  Italy: "意大利",
  "United Kingdom": "英国",
  Israel: "以色列",
};

const CATEGORY_ZH: Array<[string, string]> = [
  ["Artificial Intelligence", "人工智能"],
  ["Robotics", "机器人"],
  ["Digital Health", "数字健康"],
  ["Vehicle Tech & Advanced Mobility", "汽车科技与未来出行"],
  ["Smart Home & Appliances", "智能家居与家电"],
  ["IoT/Sensors", "物联网与传感器"],
  ["XR & Spatial Computing", "XR 与空间计算"],
  ["Wearables", "可穿戴设备"],
  ["Sustainability", "可持续科技"],
  ["Gaming & Esports", "游戏与电竞"],
  ["Content Creation", "创作者工具"],
  ["Accessories", "消费电子配件"],
  ["Startups", "创业公司"],
  ["Enterprise", "企业服务"],
  ["Fintech", "金融科技"],
  ["Beauty", "美妆科技"],
];

const DESCRIPTOR_BY_CATEGORY: Array<[string, string]> = [
  ["Digital Health", "健康科技"],
  ["Vehicle Tech & Advanced Mobility", "出行科技"],
  ["Smart Home & Appliances", "智能家居"],
  ["Robotics", "机器人"],
  ["Artificial Intelligence", "智能科技"],
  ["IoT/Sensors", "传感器科技"],
  ["XR & Spatial Computing", "空间计算"],
  ["Wearables", "可穿戴科技"],
  ["Content Creation", "创作者硬件"],
  ["Accessories", "消费电子配件"],
  ["Sustainability", "可持续科技"],
];

const LEGAL_SUFFIX_RE =
  /\b(inc\.?|incorporated|corp\.?|corporation|co\.?,?\s*ltd\.?|ltd\.?|limited|llc|gmbh|s\.?a\.?|sas|plc|ag|bv|pte\.?\s*ltd\.?)\b/gi;

function hasChinese(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function countryZh(country: string | null | undefined): string {
  if (!country) return "海外";
  return COUNTRY_ZH[country] ?? country;
}

function categoryZh(category: string): string {
  const found = CATEGORY_ZH.find(([key]) => category.includes(key));
  return found?.[1] ?? category;
}

function descriptor(categories: string[], name?: string): string {
  const normalizedName = name?.toLowerCase() ?? "";
  if (/\b(mobility|auto|vehicle|ev|drive|motor)\b/.test(normalizedName)) return "出行科技";
  if (/\b(health|care|medical|med)\b/.test(normalizedName)) return "健康科技";
  if (/\b(robot|robotics|bot)\b/.test(normalizedName)) return "机器人";
  if (/\b(home|house|living)\b/.test(normalizedName)) return "智能家居";

  const found = DESCRIPTOR_BY_CATEGORY.find(([key]) =>
    categories.some((category) => category.includes(key)),
  );
  return found?.[1] ?? "科技品牌";
}

function compactBrandToken(name: string): string {
  const paren = name.match(/^\(([^)]+)\)/);
  if (paren?.[1]) return paren[1].trim();

  const withoutSuffix = name
    .replace(LEGAL_SUFFIX_RE, "")
    .replace(/\b(company|technology|technologies|systems|solutions|labs?|studio|group)\b/gi, "")
    .replace(/[，,.\s]+$/g, "")
    .replace(/\s+[，,.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = withoutSuffix.split(" ").filter(Boolean);
  return words.slice(0, Math.min(words.length, 3)).join(" ") || name;
}

export function generateChineseBrandName(input: { name: string; categories: string[] }): string {
  const cleanName = input.name.trim();
  if (hasChinese(cleanName)) return cleanName;
  return `${compactBrandToken(cleanName)} ${descriptor(input.categories, cleanName)}`;
}

export function generateChineseBrandProfile(input: {
  name: string;
  nameZh: string;
  country: string | null;
  categories: string[];
  description: string | null;
  boothFull: string | null;
  seekFunding: string | null;
  fundingAmount: string | null;
  investmentStage: string | null;
  campaignAngles: string[];
  outreachSignals: string[];
}): string {
  const categoryText =
    input.categories.length > 0
      ? input.categories.slice(0, 4).map(categoryZh).join("、")
      : "消费科技";
  const fundingParts = [input.seekFunding, input.investmentStage, input.fundingAmount].filter(
    Boolean,
  );
  const fundingText = fundingParts.length > 0 ? `融资信息显示为 ${fundingParts.join(" / ")}。` : "";
  const boothText = input.boothFull ? `CES 展位位于 ${input.boothFull}。` : "";
  const angleText =
    input.campaignAngles.length > 0
      ? `适合围绕${input.campaignAngles.slice(0, 3).join("、")}设计达人合作内容。`
      : "适合从新品体验、场景测评和创始人访谈切入达人合作。";
  const signalText =
    input.outreachSignals.length > 0
      ? `主要外联信号：${input.outreachSignals.slice(0, 2).join("；")}。`
      : "";

  return `${input.nameZh} 是一家来自${countryZh(input.country)}的${descriptor(input.categories, input.name)}公司，CES 资料显示其重点覆盖${categoryText}等方向。${boothText}${fundingText}${angleText}${signalText}`;
}
