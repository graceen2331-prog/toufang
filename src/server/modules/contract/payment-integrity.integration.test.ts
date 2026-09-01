import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isEncrypted } from "@/server/lib/crypto";

const hasInfra = !!process.env.DATABASE_URL;

describe.skipIf(!hasInfra)("付款申请与对账完整性（集成）", () => {
  let prisma: (typeof import("@/server/db/client"))["prisma"];
  let service: typeof import("./contract.service");
  let orgId: string;
  let requesterId: string;
  let approverId: string;
  let contractId: string;
  let campaignCreatorId: string;

  beforeAll(async () => {
    process.env.PAYMENT_FINGERPRINT_KEY = "payment-integration-test-key";
    ({ prisma } = await import("@/server/db/client"));
    service = await import("./contract.service");
    const suffix = Date.now();
    const org = await prisma.organization.create({
      data: { name: "付款完整性测试组织", slug: `payment-integrity-${suffix}` },
    });
    orgId = org.id;
    const requester = await prisma.user.create({
      data: { email: `payment-requester-${suffix}@test.dev`, name: "付款申请人", passwordHash: "x" },
    });
    requesterId = requester.id;
    const approver = await prisma.user.create({
      data: { email: `payment-approver-${suffix}@test.dev`, name: "付款审批人", passwordHash: "x" },
    });
    approverId = approver.id;
    const brand = await prisma.brand.create({
      data: { tenantId: orgId, name: "付款测试品牌", slug: `payment-brand-${suffix}` },
    });
    const campaign = await prisma.campaign.create({
      data: { tenantId: orgId, brandId: brand.id, name: "付款测试 Campaign" },
    });
    const creator = await prisma.creator.create({
      data: { tenantId: orgId, displayName: "付款测试达人" },
    });
    const campaignCreator = await prisma.campaignCreator.create({
      data: {
        tenantId: orgId,
        campaignId: campaign.id,
        creatorId: creator.id,
        status: "active",
        contractStatus: "signed",
        paymentStatus: "none",
      },
    });
    campaignCreatorId = campaignCreator.id;
    const contract = await prisma.contract.create({
      data: {
        tenantId: orgId,
        campaignCreatorId,
        contractNumber: `HT-PAY-${suffix}`,
        status: "signed",
        amountCents: 100_000,
        currency: "CNY",
        paymentTerms: { text: "交付节点付款" },
        signedAt: new Date(),
      },
    });
    contractId = contract.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function paymentInput(requestKey: string, amountCents: number, milestoneKey: string) {
    return {
      request_key: requestKey,
      amount_cents: amountCents,
      currency: "CNY" as const,
      method: "bank" as const,
      milestone_key: milestoneKey,
      milestone_label: milestoneKey === "first" ? "首期付款" : "最终尾款",
      payee: {
        name: "付款测试达人",
        bank_name: "示例银行",
        account_number: "622200001234",
      },
      invoice: { exception_reason: "测试环境免票，已由财务人工确认" },
    };
  }

  it("合同级行锁阻止并发超额，重复 request_key 幂等返回同一记录", async () => {
    const ctx = { orgId, userId: requesterId };
    const requestA = randomUUID();
    const requestB = randomUUID();
    const results = await Promise.allSettled([
      service.createPayment(ctx, contractId, paymentInput(requestA, 70_000, "first")),
      service.createPayment(ctx, contractId, paymentInput(requestB, 70_000, "final")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const created = results.find((result) => result.status === "fulfilled");
    if (!created || created.status !== "fulfilled") return;
    const reused = await service.createPayment(
      ctx,
      contractId,
      paymentInput(created.value.milestone_key === "first" ? requestA : requestB, 70_000, created.value.milestone_key!),
    );
    expect(reused.id).toBe(created.value.id);
    const stored = await prisma.paymentRecord.findUnique({ where: { id: created.value.id } });
    expect(isEncrypted(stored?.accountInfo)).toBe(true);
    expect(JSON.stringify(stored?.accountInfo)).not.toContain("622200001234");
  });

  it("申请人不能自批，授权快照和对账证据与业务状态原子落库", async () => {
    const existing = await prisma.paymentRecord.findFirst({
      where: { tenantId: orgId, contractId, status: "not_started" },
    });
    expect(existing).toBeTruthy();
    const requesterCtx = { orgId, userId: requesterId };
    await service.transitionPaymentStatus(requesterCtx, existing!.id, "pending_approval");
    const submitted = await prisma.paymentRecord.findUnique({ where: { id: existing!.id } });
    const checkpoint = await prisma.humanCheckpoint.findUnique({
      where: { id: submitted!.approvalCheckpointId! },
    });
    const payload = checkpoint!.payload as Record<string, unknown>;
    expect(submitted?.approvalSnapshotHash).toBe(payload.snapshot_hash);

    await expect(
      service.decidePaymentCheckpoint(
        requesterCtx,
        checkpoint!.id,
        "approved",
        "申请人尝试自行审批",
        {
          account_manually_checked: true,
          invoice_manually_checked: true,
          snapshot_hash: submitted!.approvalSnapshotHash!,
        },
        true,
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_SELF_APPROVAL_FORBIDDEN" });
    expect(await prisma.humanCheckpoint.findUnique({ where: { id: checkpoint!.id } })).toMatchObject({
      status: "pending",
    });

    const approverCtx = { orgId, userId: approverId };
    await service.decidePaymentCheckpoint(
      approverCtx,
      checkpoint!.id,
      "approved",
      "已核对合同、收款账户和免票依据",
      {
        account_manually_checked: true,
        invoice_manually_checked: true,
        snapshot_hash: submitted!.approvalSnapshotHash!,
      },
      true,
    );
    expect(await prisma.paymentRecord.findUnique({ where: { id: existing!.id } })).toMatchObject({
      status: "approved",
      approvedBy: approverId,
    });

    const settlementKey = randomUUID();
    const reconciliationReference = `BANK-${randomUUID()}`;
    const paidAt = new Date().toISOString();
    const evidenceNote = "已核对网银回单金额和收款账号末四位";
    const reconciled = await service.reconcilePayment(approverCtx, existing!.id, {
      settlement_request_key: settlementKey,
      reconciliation_reference: reconciliationReference,
      paid_at: paidAt,
      evidence_note: evidenceNote,
      evidence_document_ref: "receipt://payment-test",
    });
    expect(reconciled).toMatchObject({
      status: "paid",
      reconciliation_evidence_present: true,
      paid_by: approverId,
    });
    expect(
      await service.reconcilePayment(approverCtx, existing!.id, {
        settlement_request_key: settlementKey,
        reconciliation_reference: reconciliationReference,
        paid_at: paidAt,
        evidence_note: evidenceNote,
        evidence_document_ref: "receipt://payment-test",
      }),
    ).toMatchObject({ id: existing!.id, status: "paid" });
    expect(await prisma.campaignCreator.findUnique({ where: { id: campaignCreatorId } })).toMatchObject({
      paymentStatus: "partial",
    });
    expect(
      await prisma.statusEvent.count({
        where: { tenantId: orgId, entityType: "payment_record", entityId: existing!.id },
      }),
    ).toBeGreaterThanOrEqual(4);
  });
});
