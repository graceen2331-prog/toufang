// Seed v1：演示组织、系统角色、演示用户、品牌与产品
// 运行：pnpm seed（可重复执行，按 slug/email 幂等 upsert）
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { SYSTEM_ROLES } from "../src/shared/constants/permissions";
import { seedCreators } from "./seed-creators";
import { seedCampaigns } from "./seed-campaigns";
import { seedContentAnalytics } from "./seed-content-analytics";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_PASSWORD = "demo1234";

async function upsertOrg(name: string, slug: string) {
  return prisma.organization.upsert({
    where: { slug },
    update: {},
    create: { name, slug, status: "active", aiMonthlyBudgetCents: 500_000 },
  });
}

async function upsertRoles(tenantId: string) {
  const roles = new Map<string, string>();
  for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { permissions: def.permissions },
      create: { tenantId, key, name: def.name, permissions: def.permissions, isSystem: true },
    });
    roles.set(key, role.id);
  }
  return roles;
}

async function upsertUser(email: string, name: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, status: "active" },
  });
}

async function upsertMembership(tenantId: string, userId: string, roleId: string) {
  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    update: { roleId },
    create: { tenantId, userId, roleId, status: "active" },
  });
}

async function main() {
  console.log("[seed] 开始写入演示数据…");
  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // ===== 组织一：星澜传媒（主演示组织） =====
  const org = await upsertOrg("星澜传媒", "xinglan");
  const roles = await upsertRoles(org.id);

  const admin = await upsertUser("admin@demo.com", "林星澜", passwordHash);
  const manager = await upsertUser("manager@demo.com", "陈品牌", passwordHash);
  const kol = await upsertUser("kol@demo.com", "赵达人", passwordHash);
  const viewer = await upsertUser("viewer@demo.com", "王只读", passwordHash);

  await upsertMembership(org.id, admin.id, roles.get("admin")!);
  await upsertMembership(org.id, manager.id, roles.get("manager")!);
  await upsertMembership(org.id, kol.id, roles.get("kol_manager")!);
  await upsertMembership(org.id, viewer.id, roles.get("viewer")!);

  // 默认工作区
  await prisma.workspace.upsert({
    where: { tenantId_slug: { tenantId: org.id, slug: "default" } },
    update: {},
    create: { tenantId: org.id, name: "默认工作区", slug: "default" },
  });

  // ===== 品牌与产品 =====
  const glowlab = await prisma.brand.upsert({
    where: { tenantId_slug: { tenantId: org.id, slug: "glowlab" } },
    update: {},
    create: {
      tenantId: org.id,
      name: "光泽实验室 GlowLab",
      slug: "glowlab",
      industry: "美妆个护",
      description: "主打成分党的功效型护肤品牌，核心人群为 22-35 岁一二线城市女性。",
      markets: ["中国大陆", "东南亚"],
      guidelines: {
        tone: "专业而亲和，重成分与实证，避免夸张促销话术",
        visual: "低饱和、实验室质感",
      },
      restrictedTerms: ["最强", "第一", "治愈", "医疗级", "药用"],
      createdBy: admin.id,
    },
  });

  const aurora = await prisma.brand.upsert({
    where: { tenantId_slug: { tenantId: org.id, slug: "aurora-sports" } },
    update: {},
    create: {
      tenantId: org.id,
      name: "极光运动 Aurora",
      slug: "aurora-sports",
      industry: "运动户外",
      description: "轻量化城市户外装备品牌，目标人群为 25-40 岁都市运动爱好者。",
      markets: ["中国大陆"],
      guidelines: { tone: "活力、真实、鼓励参与，避免精英主义叙事" },
      restrictedTerms: ["专业运动员同款", "极限保障"],
      createdBy: admin.id,
    },
  });

  const productCount = await prisma.product.count({
    where: { tenantId: org.id, deletedAt: null },
  });
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        {
          tenantId: org.id,
          brandId: glowlab.id,
          name: "焕亮维C精华",
          category: "精华液",
          description: "15% VC 衍生物复配烟酰胺，主打提亮与抗氧化。",
          price: { amount: 289, currency: "CNY" },
          keyClaims: ["28 天可见提亮", "温和不刺激", "成分浓度透明"],
          restrictedClaims: ["医疗功效", "祛斑（未取得特证）"],
          createdBy: admin.id,
        },
        {
          tenantId: org.id,
          brandId: glowlab.id,
          name: "屏障修护面霜",
          category: "面霜",
          description: "神经酰胺复配角鲨烷，敏感肌适用。",
          price: { amount: 219, currency: "CNY" },
          keyClaims: ["修护屏障", "敏感肌友好", "无香精配方"],
          restrictedClaims: ["治疗湿疹", "医用敷料"],
          createdBy: admin.id,
        },
        {
          tenantId: org.id,
          brandId: aurora.id,
          name: "城市轻越野跑鞋 UT-1",
          category: "跑鞋",
          description: "城市路面与轻越野两用，前掌宽楦设计。",
          price: { amount: 699, currency: "CNY" },
          keyClaims: ["双密度中底", "城市轻越野两用", "宽楦舒适"],
          restrictedClaims: ["防止运动损伤"],
          createdBy: admin.id,
        },
      ],
    });
  }

  // ===== 达人（seed v2）=====
  await seedCreators(prisma, org.id, admin.id);

  // ===== Campaign（seed v3）=====
  await seedCampaigns(prisma, org.id, admin.id);

  // ===== 内容审核与分析（seed v4）=====
  await seedContentAnalytics(prisma, org.id, admin.id);

  // ===== 组织二：北辰品牌部（验证租户隔离与多组织切换） =====
  const org2 = await upsertOrg("北辰品牌部", "beichen");
  const roles2 = await upsertRoles(org2.id);
  await upsertMembership(org2.id, admin.id, roles2.get("manager")!); // admin 在第二组织是 manager
  const org2Admin = await upsertUser("admin2@demo.com", "周北辰", passwordHash);
  await upsertMembership(org2.id, org2Admin.id, roles2.get("admin")!);

  await prisma.brand.upsert({
    where: { tenantId_slug: { tenantId: org2.id, slug: "polar" } },
    update: {},
    create: {
      tenantId: org2.id,
      name: "北极星饮品",
      slug: "polar",
      industry: "食品饮料",
      markets: ["中国大陆"],
      createdBy: org2Admin.id,
    },
  });

  console.log("[seed] 完成 ✅");
  console.log("演示账号（密码均为 demo1234）：");
  console.log("  admin@demo.com    管理员（星澜传媒 + 北辰品牌部双组织）");
  console.log("  manager@demo.com  市场经理");
  console.log("  kol@demo.com      达人运营");
  console.log("  viewer@demo.com   只读成员");
}

main()
  .catch((err) => {
    console.error("[seed] 失败", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
