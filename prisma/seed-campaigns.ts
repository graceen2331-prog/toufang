// Seed v3：演示 Campaign（含达人管道 / 任务 / 预算 / 状态历史 / 审批项）
import type { PrismaClient } from "../src/generated/prisma/client";
import { createPayment, transitionPaymentStatus } from "../src/server/modules/contract/contract.service";

export async function seedCampaigns(
  prisma: PrismaClient,
  tenantId: string,
  createdBy: string,
): Promise<void> {
  const existing = await prisma.campaign.count({ where: { tenantId, deletedAt: null } });
  if (existing > 0) {
    console.log(`[seed] Campaign 数据已存在（${existing} 个），补齐 W6 外联/合同演示数据`);
    await seedOutreachContracts(prisma, tenantId, createdBy);
    return;
  }

  const glowlab = await prisma.brand.findFirst({
    where: { tenantId, slug: "glowlab", deletedAt: null },
  });
  const aurora = await prisma.brand.findFirst({
    where: { tenantId, slug: "aurora-sports", deletedAt: null },
  });
  const vcSerum = await prisma.product.findFirst({
    where: { tenantId, name: "焕亮维C精华", deletedAt: null },
  });
  if (!glowlab || !aurora) return;

  // ---- Campaign 1：进行中（外联阶段） ----
  const c1 = await prisma.campaign.create({
    data: {
      tenantId,
      brandId: glowlab.id,
      productId: vcSerum?.id ?? null,
      name: "焕亮维C精华 双十一种草战役",
      objective: "conversion",
      status: "outreach",
      healthStatus: "on_track",
      markets: ["中国大陆"],
      platforms: ["douyin", "xiaohongshu"],
      budgetTotalCents: 50_000_000, // ¥50 万
      currency: "CNY",
      goals: { impressions: 20_000_000, engagement: 800_000, conversions: 15_000, roi: 2.5 },
      startDate: new Date("2026-09-15"),
      endDate: new Date("2026-11-15"),
      ownerId: createdBy,
      createdBy,
    },
  });
  // 状态历史（走过的阶段）
  const c1Path = ["draft", "strategy", "research", "creator_discovery", "shortlisting", "brief_creation", "outreach"];
  for (let i = 0; i < c1Path.length; i++) {
    await prisma.statusEvent.create({
      data: {
        tenantId,
        entityType: "campaign",
        entityId: c1.id,
        fromValue: i === 0 ? null : c1Path[i - 1]!,
        toValue: c1Path[i]!,
        actorType: i < 2 ? "user" : "system",
        actorId: i < 2 ? createdBy : null,
        createdAt: new Date(Date.now() - (c1Path.length - i) * 3 * 86400_000),
      },
    });
  }

  // 挂 8 位达人到不同阶段
  const creators = await prisma.creator.findMany({
    where: { tenantId, deletedAt: null, relationshipStatus: { notIn: ["blacklisted", "archived"] } },
    take: 8,
    orderBy: { createdAt: "asc" },
  });
  const ccStatuses = [
    { status: "contacted", contentStatus: "none" },
    { status: "contacted", contentStatus: "none" },
    { status: "replied", contentStatus: "none" },
    { status: "negotiating", contentStatus: "none" },
    { status: "confirmed", contentStatus: "briefed", contractStatus: "in_review" },
    { status: "active", contentStatus: "in_production", contractStatus: "signed", paymentStatus: "pending" },
    { status: "shortlisted", contentStatus: "none" },
    { status: "candidate", contentStatus: "none" },
  ];
  for (let i = 0; i < Math.min(creators.length, ccStatuses.length); i++) {
    const s = ccStatuses[i]!;
    await prisma.campaignCreator.create({
      data: {
        tenantId,
        campaignId: c1.id,
        creatorId: creators[i]!.id,
        status: s.status,
        contractStatus: s.contractStatus ?? "none",
        paymentStatus: s.paymentStatus ?? "none",
        contentStatus: s.contentStatus,
        role: i < 2 ? "hero" : i < 5 ? "amplifier" : "seeder",
        quotedPriceCents: (i + 3) * 500_000,
        agreedPriceCents: ["confirmed", "active"].includes(s.status) ? (i + 3) * 450_000 : null,
        matchScore: Math.round((0.6 + i * 0.04) * 100) / 100,
        aiGenerated: i < 5,
        createdBy,
      },
    });
  }

  // 任务
  await prisma.campaignTask.createMany({
    data: [
      { tenantId, campaignId: c1.id, title: "确认双十一档期排期表", status: "in_progress", priority: "high", assigneeId: createdBy, dueAt: new Date(Date.now() + 3 * 86400_000), createdBy },
      { tenantId, campaignId: c1.id, title: "收集已确认达人的收件信息", status: "todo", priority: "normal", createdBy },
      { tenantId, campaignId: c1.id, title: "完成 Brief 法务复核", status: "done", priority: "urgent", createdBy },
    ],
  });

  // 预算项
  await prisma.campaignBudgetItem.createMany({
    data: [
      { tenantId, campaignId: c1.id, category: "creator_fee", name: "头部达人合作费", plannedCents: 30_000_000, reservedCents: 9_000_000, spentCents: 0, currency: "CNY", createdBy },
      { tenantId, campaignId: c1.id, category: "creator_fee", name: "腰部达人合作费", plannedCents: 12_000_000, reservedCents: 4_500_000, spentCents: 0, currency: "CNY", createdBy },
      { tenantId, campaignId: c1.id, category: "production", name: "样品与物流", plannedCents: 2_000_000, reservedCents: 0, spentCents: 800_000, currency: "CNY", createdBy },
      { tenantId, campaignId: c1.id, category: "media", name: "优质内容投流放大", plannedCents: 6_000_000, reservedCents: 0, spentCents: 0, currency: "CNY", createdBy },
    ],
  });

  // ---- Campaign 2：草稿 ----
  await prisma.campaign.create({
    data: {
      tenantId,
      brandId: aurora.id,
      name: "UT-1 跑鞋城市轻越野首发",
      objective: "launch",
      status: "draft",
      markets: ["中国大陆"],
      platforms: ["bilibili", "douyin"],
      budgetTotalCents: 20_000_000,
      currency: "CNY",
      goals: { impressions: 8_000_000, engagement: 300_000 },
      ownerId: createdBy,
      createdBy,
    },
  });

  // ---- 审批项（演示审批中心） ----
  await prisma.humanCheckpoint.createMany({
    data: [
      {
        tenantId,
        type: "budget",
        status: "pending",
        title: "双十一战役预算调整：头部达人费用上调 ¥3 万",
        summary: "「林小鹿日记」报价高于预估，需上调头部达人预算项。",
        entityType: "campaign",
        entityId: c1.id,
        payload: { from_cents: 30_000_000, to_cents: 33_000_000, reason: "头部达人报价上浮" },
        priority: "high",
        assigneeRole: "manager",
        createdBy,
      },
      {
        tenantId,
        type: "shortlist",
        status: "approved",
        title: "双十一战役达人入围名单（8 人）",
        summary: "AI 推荐 12 人，人工筛选后确认 8 人进入执行管道。",
        entityType: "campaign",
        entityId: c1.id,
        payload: { candidates: 12, approved: 8 },
        priority: "normal",
        decidedBy: createdBy,
        decidedAt: new Date(Date.now() - 5 * 86400_000),
        decisionReason: "名单质量符合预期，两位高风险达人已剔除",
        createdBy,
      },
    ],
  });

  await seedOutreachContracts(prisma, tenantId, createdBy);

  console.log("[seed] 已写入 2 个演示 Campaign（含达人管道/任务/预算/审批项）");
}

async function seedOutreachContracts(
  prisma: PrismaClient,
  tenantId: string,
  createdBy: string,
): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { tenantId, name: "焕亮维C精华 双十一种草战役", deletedAt: null },
  });
  if (!campaign) return;

  const budgetCheckpoint = await prisma.humanCheckpoint.findFirst({
    where: {
      tenantId,
      type: "budget",
      entityType: "campaign",
      entityId: campaign.id,
      status: "pending",
      title: "双十一战役预算调整：头部达人费用上调 ¥3 万",
    },
  });
  if (!budgetCheckpoint) {
    await prisma.humanCheckpoint.create({
      data: {
        tenantId,
        type: "budget",
        status: "pending",
        title: "双十一战役预算调整：头部达人费用上调 ¥3 万",
        summary: "「林小鹿日记」报价高于预估，需上调头部达人预算项。",
        entityType: "campaign",
        entityId: campaign.id,
        payload: { from_cents: 30_000_000, to_cents: 33_000_000, reason: "头部达人报价上浮" },
        priority: "high",
        assigneeRole: "manager",
        createdBy,
      },
    });
  }

  const campaignCreators = await prisma.campaignCreator.findMany({
    where: {
      tenantId,
      campaignId: campaign.id,
      deletedAt: null,
      status: { in: ["contacted", "replied", "negotiating", "confirmed", "active"] },
    },
    include: { creator: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const cc of campaignCreators) {
    let thread = await prisma.outreachThread.findFirst({
      where: { tenantId, campaignCreatorId: cc.id, deletedAt: null },
    });
    if (!thread) {
      thread = await prisma.outreachThread.create({
        data: {
          tenantId,
          campaignCreatorId: cc.id,
          channel: "email",
          status:
            cc.status === "active" || cc.status === "confirmed"
              ? "closed_won"
              : cc.status === "negotiating"
                ? "negotiating"
                : cc.status === "replied"
                  ? "replied"
                  : "open",
          subject: `GlowLab 双十一合作邀约 - ${cc.creator.displayName}`,
          lastMessageAt: new Date(Date.now() - 2 * 86400_000),
          createdBy,
        },
      });
    }

    const messageCount = await prisma.outreachMessage.count({
      where: { tenantId, threadId: thread.id, deletedAt: null },
    });
    if (messageCount === 0) {
      await prisma.outreachMessage.create({
        data: {
          tenantId,
          threadId: thread.id,
          direction: "outbound",
          status: "sent",
          approvalStatus: "approved",
          subject: thread.subject,
          body: `你好 ${cc.creator.displayName}，我们是光泽实验室 GlowLab，想邀请你参与焕亮维C精华双十一种草合作。期待结合你的真实护肤体验，共创一条内容。`,
          sentAt: new Date(Date.now() - 4 * 86400_000),
          createdBy,
        },
      });

      if (["replied", "negotiating", "confirmed", "active"].includes(cc.status)) {
        await prisma.outreachMessage.create({
          data: {
            tenantId,
            threadId: thread.id,
            direction: "inbound",
            status: "replied",
            approvalStatus: "not_required",
            subject: "Re: 合作邀约",
            body: `有兴趣了解，档期可以配合。我的报价是 ¥${((cc.quotedPriceCents ?? 4_000_000) / 100).toLocaleString("zh-CN")}，需要确认产品试用周期和内容授权范围。`,
            replyIntent: cc.status === "replied" ? "need_info" : "negotiate",
            createdBy,
          },
        });
      }
    }

    if (["negotiating", "confirmed", "active"].includes(cc.status)) {
      const negotiation = await prisma.negotiationRecord.findFirst({
        where: { tenantId, threadId: thread.id, deletedAt: null },
      });
      if (!negotiation) {
        await prisma.negotiationRecord.create({
          data: {
            tenantId,
            threadId: thread.id,
            status: cc.status === "negotiating" ? "negotiating" : "agreed",
            quotedPriceCents: cc.quotedPriceCents,
            counterPriceCents: cc.quotedPriceCents
              ? Math.round(cc.quotedPriceCents * 0.9)
              : 3_600_000,
            agreedPriceCents: cc.agreedPriceCents,
            pricingAnalysis: {
              summary: "报价处于腰部达人合理区间，建议用档期资源和二次投流权益换取小幅降价。",
            },
            strategy: {
              items: ["先确认内容授权周期", "用样品体验周期换取更稳定的发布时间", "保留二次投流白名单选项"],
              intent: cc.status === "negotiating" ? "negotiate" : "interested",
              intent_summary: "达人对合作有明确兴趣，主要待确认报价和授权范围。",
              reply_draft: "我们可以接受核心报价方向，希望授权周期控制在 30 天，并将交付物明确到短视频 1 条。",
              required_approvals: cc.status === "negotiating" ? ["manager"] : [],
              risk_notes: [],
            },
            agreedTerms:
              cc.status === "negotiating"
                ? {}
                : {
                    deliverables: ["短视频 1 条", "图文种草 1 篇"],
                    usage_rights: "品牌官方账号 30 天二次分发授权",
                    payment_terms: "内容验收通过后 7 个工作日付款",
                  },
            createdBy,
          },
        });
      }
    }

    if (["confirmed", "active"].includes(cc.status)) {
      let contract = await prisma.contract.findFirst({
        where: { tenantId, campaignCreatorId: cc.id, deletedAt: null },
      });
      if (!contract) {
        contract = await prisma.contract.create({
          data: {
            tenantId,
            campaignCreatorId: cc.id,
            // 注意：id 为 UUIDv7（时间前缀），取末段随机部分保证 contract_number 唯一
            contractNumber: `HT-SEED-${cc.id.slice(-12).toUpperCase()}`,
            status: cc.status === "active" ? "signed" : "in_review",
            amountCents: cc.agreedPriceCents ?? 4_500_000,
            currency: cc.currency,
            usageRights: { text: "品牌官方账号 30 天二次分发授权" },
            exclusivityTerms: { text: "合作期内不发布直接竞品同主题内容" },
            paymentTerms: { text: "内容验收通过后 7 个工作日付款" },
            signedAt: cc.status === "active" ? new Date(Date.now() - 86400_000) : null,
            createdBy,
          },
        });
      }

      if (contract.status === "in_review") {
        const checkpoint = await prisma.humanCheckpoint.findFirst({
          where: {
            tenantId,
            entityType: "contract",
            entityId: contract.id,
            status: "pending",
          },
        });
        if (!checkpoint) {
          await prisma.humanCheckpoint.create({
            data: {
              tenantId,
              type: "contract",
              status: "pending",
              title: `合同审批：${cc.creator.displayName}`,
              summary: `合同 ${contract.contractNumber}，金额 ¥${(contract.amountCents / 100).toLocaleString("zh-CN")}`,
              entityType: "contract",
              entityId: contract.id,
              payload: { contract_number: contract.contractNumber, amount_cents: contract.amountCents },
              priority: "high",
              assigneeRole: "manager",
              createdBy,
            },
          });
        }
      }

      if (cc.status === "active") {
        const payment = await prisma.paymentRecord.findFirst({
          where: { tenantId, contractId: contract.id, deletedAt: null },
        });
        if (!payment) {
          const createdPayment = await createPayment(
            { orgId: tenantId, userId: createdBy },
            contract.id,
            {
              request_key: crypto.randomUUID(),
              amount_cents: Math.round(contract.amountCents * 0.5),
              currency: "CNY",
              method: "bank",
              milestone_key: "first_payment",
              milestone_label: "首期付款",
              payee: {
                name: cc.creator.displayName,
                bank_name: "演示银行",
                account_number: `62220000${cc.id.replaceAll("-", "").slice(-4)}`,
              },
              invoice: { exception_reason: "演示数据暂无发票，需财务人工核对" },
              notes: "首期付款，等待财务审批",
            },
          );
          await transitionPaymentStatus(
            { orgId: tenantId, userId: createdBy },
            createdPayment.id,
            "pending_approval",
          );
        } else if (payment.status === "not_started" && payment.requestKey) {
          await transitionPaymentStatus(
            { orgId: tenantId, userId: createdBy },
            payment.id,
            "pending_approval",
          );
        }
        const pendingPayment = await prisma.paymentRecord.findFirst({
          where: {
            tenantId,
            contractId: contract.id,
            status: "pending_approval",
            deletedAt: null,
          },
        });
        if (pendingPayment && !pendingPayment.approvalCheckpointId) {
          console.warn(
            `[seed] 跳过旧版付款审批项 ${pendingPayment.id}：缺少完整审批快照，请在界面重新登记`,
          );
        }
      }
    }
  }

  console.log("[seed] 已补齐 W6 外联/谈判/合同/付款演示数据");
}
