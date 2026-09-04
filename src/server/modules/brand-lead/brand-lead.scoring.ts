export interface BrandLeadScoringInput {
  productCategories: string[];
  country: string | null;
  description: string | null;
  website: string | null;
  seekFunding: string | null;
  fundingAmount: string | null;
  revenue: string | null;
  investmentStage: string | null;
}

const HOT_CATEGORIES = new Set([
  "Artificial Intelligence",
  "Robotics",
  "Digital Health",
  "Vehicle Tech & Advanced Mobility",
  "Smart Home & Appliances",
  "Startups",
  "IoT/Sensors",
]);

const CATEGORY_PROFILE: Array<{ match: string; profile: string; angles: string[] }> = [
  {
    match: "Digital Health",
    profile: "健康科技测评达人、家庭健康生活方式达人、医疗科普型内容创作者",
    angles: ["CES 新品体验", "健康场景测评", "家庭用户教育"],
  },
  {
    match: "Smart Home & Appliances",
    profile: "智能家居达人、家电测评达人、生活方式内容创作者",
    angles: ["智能家庭改造", "新品场景短视频", "跨平台测评种草"],
  },
  {
    match: "Vehicle Tech & Advanced Mobility",
    profile: "汽车科技达人、出行生活方式达人、硬件深度评测创作者",
    angles: ["未来出行体验", "展会现场探访", "技术亮点解读"],
  },
  {
    match: "Robotics",
    profile: "机器人/AI 硬件测评达人、科技教育创作者、B2B 科技评论者",
    angles: ["机器人真实场景演示", "技术科普", "创始人访谈"],
  },
  {
    match: "Artificial Intelligence",
    profile: "AI 工具测评达人、效率科技创作者、B2B SaaS 内容作者",
    angles: ["AI 应用案例", "创始人访谈", "垂直场景 Demo"],
  },
];

function isSeekingFunding(value: string | null): boolean {
  return Boolean(value && /yes|seeking|true|是|融资/i.test(value));
}

export function scoreBrandLead(input: BrandLeadScoringInput): {
  score: number;
  tier: "priority" | "nurture" | "watch";
  recommendedCreatorProfile: string;
  campaignAngles: string[];
  outreachSignals: string[];
} {
  let score = 20;
  const signals: string[] = [];

  const hotMatches = input.productCategories.filter((category) => HOT_CATEGORIES.has(category));
  score += Math.min(hotMatches.length * 8, 28);
  if (hotMatches.length > 0) signals.push(`热门 CES 品类：${hotMatches.slice(0, 3).join(" / ")}`);

  if (isSeekingFunding(input.seekFunding)) {
    score += 18;
    signals.push("正在寻求融资，通常更需要曝光、投资人可见度和市场验证内容");
  }
  if (input.investmentStage) {
    score += 8;
    signals.push(`融资阶段明确：${input.investmentStage}`);
  }
  if (input.fundingAmount) {
    score += 6;
    signals.push(`融资金额区间：${input.fundingAmount}`);
  }
  if (input.revenue) {
    score += 5;
    signals.push(`营收区间可用：${input.revenue}`);
  }
  if (input.website) score += 5;
  if (input.description && input.description.length > 80) score += 6;
  if (input.country && ["United States", "China", "South Korea", "France", "Taiwan"].includes(input.country)) {
    score += 4;
  }

  const scoreCapped = Math.min(score, 100);
  const tier = scoreCapped >= 72 ? "priority" : scoreCapped >= 52 ? "nurture" : "watch";
  const categoryProfile = CATEGORY_PROFILE.find((item) =>
    input.productCategories.some((category) => category.includes(item.match)),
  );

  return {
    score: scoreCapped,
    tier,
    recommendedCreatorProfile:
      categoryProfile?.profile ?? "科技测评达人、展会探访型创作者、LinkedIn/B2B 内容作者",
    campaignAngles:
      categoryProfile?.angles ?? ["CES 展会新品解读", "创始人访谈", "品牌出海故事"],
    outreachSignals: signals.slice(0, 5),
  };
}
