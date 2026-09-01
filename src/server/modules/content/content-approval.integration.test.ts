import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { evaluateDeterministicContent, mergeContentReview } from "./content-policy";

const hasInfra = !!process.env.DATABASE_URL;

describe.skipIf(!hasInfra)("内容合规审批证据（集成）", () => {
  let prisma: (typeof import("@/server/db/client"))["prisma"];
  let contentRepository: (typeof import("./content.repository"))["contentRepository"];
  let orgId: string;
  let userId: string;
  let campaignId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db/client"));
    ({ contentRepository } = await import("./content.repository"));
    const suffix = Date.now();
    const org = await prisma.organization.create({
      data: { name: "内容门禁测试组织", slug: `content-gate-${suffix}` },
    });
    orgId = org.id;
    const user = await prisma.user.create({
      data: { email: `content-gate-${suffix}@test.dev`, name: "内容审核员", passwordHash: "x" },
    });
    userId = user.id;
    const brand = await prisma.brand.create({
      data: { tenantId: orgId, name: "门禁测试品牌", slug: `content-gate-brand-${suffix}` },
    });
    const campaign = await prisma.campaign.create({
      data: { tenantId: orgId, brandId: brand.id, name: "内容门禁 Campaign" },
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createReviewCase(input: {
    caption: string;
    restrictedTerms?: string[];
    aiHigh?: boolean;
  }) {
    const creator = await prisma.creator.create({
      data: { tenantId: orgId, displayName: `测试达人-${randomUUID().slice(0, 8)}` },
    });
    const campaignCreator = await prisma.campaignCreator.create({
      data: {
        tenantId: orgId,
        campaignId,
        creatorId: creator.id,
        contentStatus: "submitted",
      },
    });
    const assetId = randomUUID();
    const reviewId = randomUUID();
    const deterministic = evaluateDeterministicContent({
      platform: "douyin",
      caption: input.caption,
      transcript: null,
      brandRestrictedTerms: input.restrictedTerms ?? [],
      briefContent: {},
    });
    const review = mergeContentReview(
      {
        decision: "approved",
        risk_level: input.aiHigh ? "high" : "low",
        findings: input.aiHigh
          ? [
              {
                type: "semantic_claim",
                severity: "high",
                quote: input.caption,
                issue: "AI 建议核验语义风险",
                suggestion: "人工核对证据",
              },
            ]
          : [],
        creator_feedback: input.aiHigh ? "请人工核验。" : "可以发布。",
      },
      deterministic,
    );
    await prisma.contentAsset.create({
      data: {
        id: assetId,
        tenantId: orgId,
        campaignCreatorId: campaignCreator.id,
        status: "in_review",
        platform: "douyin",
        caption: input.caption,
        activeReviewId: reviewId,
      },
    });
    await prisma.contentReview.create({
      data: {
        id: reviewId,
        tenantId: orgId,
        contentAssetId: assetId,
        status: "reviewing",
        decision: review.decision,
        riskLevel: review.risk_level,
        findings: review.findings as unknown as object,
        feedback: review.creator_feedback,
        inputHash: review.input_hash,
        ruleSetVersion: review.rule_set_version,
        deterministicSummary: review.deterministic_summary as unknown as object,
        normalizationNotes: review.normalization_notes,
      },
    });
    const checkpoint = await prisma.humanCheckpoint.create({
      data: {
        tenantId: orgId,
        type: "content",
        entityType: "content_asset",
        entityId: assetId,
        title: "内容审核复核",
        payload: {
          review_id: reviewId,
          input_hash: review.input_hash,
          rule_set_version: review.rule_set_version,
          review,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return { assetId, reviewId, checkpoint, campaignCreator, review };
  }

  it("确定性 blocking 规则不能由人工批准，并可原子退回修改", async () => {
    const testCase = await createReviewCase({
      caption: "医疗级配方可以治愈暗沉",
      restrictedTerms: ["医疗级", "治愈"],
    });
    const ctx = { orgId, userId };

    const blocked = await contentRepository.decideContentCheckpoint({
      ctx,
      checkpointId: testCase.checkpoint.id,
      decision: "approved",
      reason: "已经人工看过并希望直接批准",
    });
    expect(blocked.kind).toBe("blocking_findings");
    expect(
      await prisma.humanCheckpoint.findUnique({ where: { id: testCase.checkpoint.id } }),
    ).toMatchObject({ status: "pending" });

    const decided = await contentRepository.decideContentCheckpoint({
      ctx,
      checkpointId: testCase.checkpoint.id,
      decision: "changes_requested",
      reason: "请删除品牌禁用词后重新提交",
    });
    expect(decided.kind).toBe("decided");
    expect(await prisma.contentAsset.findUnique({ where: { id: testCase.assetId } })).toMatchObject({
      status: "revision_requested",
      activeReviewId: null,
      approvedReviewId: null,
    });
    expect(await prisma.contentReview.findUnique({ where: { id: testCase.reviewId } })).toMatchObject({
      status: "completed",
      finalDecision: "changes_requested",
      reviewerId: userId,
      checkpointId: testCase.checkpoint.id,
    });
    expect(
      await prisma.campaignCreator.findUnique({ where: { id: testCase.campaignCreator.id } }),
    ).toMatchObject({ contentStatus: "submitted" });
  });

  it("AI high 必须完整确认后批准，发布再校验正文哈希与审批证据", async () => {
    const testCase = await createReviewCase({ caption: "这是一段真实体验分享", aiHigh: true });
    const ctx = { orgId, userId };
    const advisoryIds = testCase.review.findings
      .filter((finding) => finding.severity === "high" && !finding.blocking)
      .map((finding) => finding.id);

    const missingOverride = await contentRepository.decideContentCheckpoint({
      ctx,
      checkpointId: testCase.checkpoint.id,
      decision: "approved",
      reason: null,
    });
    expect(missingOverride.kind).toBe("override_required");

    const decided = await contentRepository.decideContentCheckpoint({
      ctx,
      checkpointId: testCase.checkpoint.id,
      decision: "approved",
      reason: "已逐项核验原始证据，确认属于可接受表达",
      override: {
        enabled: true,
        category: "evidence_verified",
        acknowledged_finding_ids: advisoryIds,
      },
    });
    expect(decided.kind).toBe("decided");
    expect(await prisma.contentAsset.findUnique({ where: { id: testCase.assetId } })).toMatchObject({
      status: "approved",
      approvedReviewId: testCase.reviewId,
      approvedCheckpointId: testCase.checkpoint.id,
      approvedContentHash: testCase.review.input_hash,
    });

    const published = await contentRepository.publishWithApprovalEvidence({
      ctx,
      assetId: testCase.assetId,
      fromStatus: "approved",
      toStatus: "published",
      reason: "内容已发布",
    });
    expect(published.kind).toBe("published");
    expect(
      await prisma.campaignCreator.findUnique({ where: { id: testCase.campaignCreator.id } }),
    ).toMatchObject({ contentStatus: "published" });
  });

  it("正文被改动或审批并发时不会生成虚假批准", async () => {
    const changedCase = await createReviewCase({ caption: "原始可发布正文" });
    const ctx = { orgId, userId };
    const approved = await contentRepository.decideContentCheckpoint({
      ctx,
      checkpointId: changedCase.checkpoint.id,
      decision: "approved",
      reason: null,
    });
    expect(approved.kind).toBe("decided");
    await prisma.contentAsset.update({
      where: { id: changedCase.assetId },
      data: { caption: "审批后被改动的正文" },
    });
    expect(
      await contentRepository.publishWithApprovalEvidence({
        ctx,
        assetId: changedCase.assetId,
        fromStatus: "approved",
        toStatus: "published",
        reason: null,
      }),
    ).toMatchObject({ kind: "invalid_evidence" });

    const concurrentCase = await createReviewCase({ caption: "并发审批正文" });
    const results = await Promise.all([
      contentRepository.decideContentCheckpoint({
        ctx,
        checkpointId: concurrentCase.checkpoint.id,
        decision: "approved",
        reason: null,
      }),
      contentRepository.decideContentCheckpoint({
        ctx,
        checkpointId: concurrentCase.checkpoint.id,
        decision: "rejected",
        reason: "并发驳回测试",
      }),
    ]);
    expect(results.filter((result) => result.kind === "decided")).toHaveLength(1);
    expect(results.filter((result) => result.kind !== "decided")).toHaveLength(1);
  });
});
