// Seed v2：中文达人演示数据（50 位，含平台账号 / 快照 / 内容样本 / 笔记）
// 由 prisma/seed.ts 调用；幂等：已有达人数据时跳过
import type { PrismaClient } from "../src/generated/prisma/client";

const CATEGORIES = [
  ["美妆", "护肤测评"],
  ["美妆", "彩妆教程"],
  ["运动健身", "跑步"],
  ["运动健身", "健身教学"],
  ["美食", "探店"],
  ["美食", "家常菜"],
  ["母婴", "育儿经验"],
  ["数码", "手机测评"],
  ["时尚穿搭", "通勤穿搭"],
  ["生活方式", "vlog"],
] as const;

const SURNAMES = "林陈王李张刘杨黄吴赵周徐孙马朱胡郭何罗高";
const GIVEN = ["小鹿", "阿茶", "一一", "可可", "大力", "沐沐", "然然", "十三", "半夏", "青柠", "米粒", "多多", "安安", "布丁", "奶盖", "山竹", "南风", "北鱼", "早早", "晚晚"];
const SUFFIX = ["日记", "研究所", "笔记", "实验室", "手记", "小馆", "频道", "计划", ""];

const STATUSES = [
  "new", "new", "new", "new", "new", "new",
  "shortlisted", "shortlisted", "shortlisted",
  "contacted", "contacted", "contacted",
  "replied", "negotiating", "negotiating",
  "confirmed", "confirmed",
  "active", "active",
  "completed", "completed", "completed",
  "long_term_partner", "long_term_partner",
  "rejected", "blacklisted",
];

const PLATFORM_POOL = ["douyin", "xiaohongshu", "bilibili", "weibo", "kuaishou"] as const;

// 简单的确定性伪随机（seed 结果可复现）
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedCreators(
  prisma: PrismaClient,
  tenantId: string,
  createdBy: string,
): Promise<void> {
  const existing = await prisma.creator.count({ where: { tenantId, deletedAt: null } });
  if (existing >= 50) {
    console.log(`[seed] 达人数据已存在（${existing} 位），跳过`);
    return;
  }

  const rand = mulberry32(20260704);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

  const usedNames = new Set<string>();

  for (let i = 0; i < 50; i++) {
    let name = "";
    do {
      name = `${pick([...SURNAMES])}${pick(GIVEN)}${pick(SUFFIX)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const [mainCat, subCat] = CATEGORIES[i % CATEGORIES.length]!;
    const status = STATUSES[i % STATUSES.length]!;
    const risk = rand() < 0.08 ? "high" : rand() < 0.25 ? "medium" : rand() < 0.7 ? "low" : "unknown";
    const tags = [
      ...(rand() < 0.4 ? ["高互动"] : []),
      ...(rand() < 0.3 ? ["性价比高"] : []),
      ...(rand() < 0.25 ? ["配合度好"] : []),
      ...(rand() < 0.2 ? ["档期紧张"] : []),
      ...(status === "long_term_partner" ? ["长期合作"] : []),
    ];

    const creator = await prisma.creator.create({
      data: {
        tenantId,
        displayName: name,
        bio: `专注${mainCat} · ${subCat}方向的内容创作者，风格${pick(["真实接地气", "专业细致", "轻松幽默", "精致高级"])}，粉丝粘性${pick(["高", "较高", "中等"])}。`,
        relationshipStatus: status,
        riskLevel: risk,
        country: "中国大陆",
        languages: ["zh-CN"],
        categories: [mainCat, subCat],
        tags,
        source: i < 30 ? "import" : "manual",
        createdBy,
      },
    });

    // 平台账号：1-3 个
    const platformCount = randInt(1, 3);
    const platforms = [...PLATFORM_POOL].sort(() => rand() - 0.5).slice(0, platformCount);
    for (const platform of platforms) {
      const followers = randInt(8, 300) * 10_000 + randInt(0, 9999);
      await prisma.creatorPlatformAccount.create({
        data: {
          tenantId,
          creatorId: creator.id,
          platform,
          handle: `${name.replace(/[^一-龥a-zA-Z]/g, "")}_${platform.slice(0, 2)}${i}`,
          followers,
          engagementRate: Math.round((rand() * 8 + 0.5) * 10) / 10,
          avgViews: Math.floor(followers * (rand() * 0.3 + 0.05)),
          metrics: {},
        },
      });
    }

    // 快照（受众画像）
    await prisma.creatorMetricSnapshot.create({
      data: {
        tenantId,
        creatorId: creator.id,
        kind: "audience",
        payload: {
          gender: { female: randInt(40, 90), male: 0 },
          age_18_24: randInt(15, 40),
          age_25_34: randInt(30, 55),
          top_cities: ["上海", "北京", "杭州", "成都"].slice(0, randInt(2, 4)),
        },
        source: "import",
      },
    });

    // 部分达人有内容样本与笔记
    if (rand() < 0.5) {
      await prisma.creatorContentSample.create({
        data: {
          tenantId,
          creatorId: creator.id,
          platform: platforms[0]!,
          title: `${subCat}｜${pick(["新手必看", "亲测有效", "真实分享", "深度测评"])}`,
          contentType: pick(["video", "image", "article"]),
          metrics: { views: randInt(5, 200) * 10_000, likes: randInt(1, 20) * 1_000 },
          publishedAt: new Date(Date.now() - randInt(3, 90) * 86400_000),
        },
      });
    }
    if (["confirmed", "active", "completed", "long_term_partner"].includes(status)) {
      await prisma.creatorNote.create({
        data: {
          tenantId,
          creatorId: creator.id,
          content: pick([
            "沟通顺畅，回复及时，报价在预算范围内。",
            "内容质量稳定，建议优先安排重点 Campaign。",
            "偏好长期合作模式，对单次投放兴趣一般。",
            "需要提前两周约档期，旺季档期非常紧张。",
          ]),
          createdBy,
        },
      });
    }
  }

  console.log("[seed] 已写入 50 位演示达人");
}
