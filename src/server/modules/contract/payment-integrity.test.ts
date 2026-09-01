import { beforeAll, describe, expect, it } from "vitest";

describe("付款完整性快照", () => {
  beforeAll(() => {
    process.env.PAYMENT_FINGERPRINT_KEY = "payment-integrity-test-key";
  });

  it("规范化账户后生成稳定 HMAC 指纹且不暴露完整账号", async () => {
    const { normalizePaymentEvidence } = await import("./payment-integrity");
    const left = normalizePaymentEvidence(
      { name: " 某某 ", bank_name: "某 银行", account_number: "6222-0000 1234" },
      { number: " INV-001 ", issuer: "品牌公司" },
    );
    const right = normalizePaymentEvidence(
      { name: "某某", bank_name: "某 银行", account_number: "622200001234" },
      { number: "INV-001", issuer: "品牌公司" },
    );

    expect(left.payee.account_fingerprint).toBe(right.payee.account_fingerprint);
    expect(left.payee.account_last4).toBe("1234");
    expect(left.payee.account_fingerprint).not.toContain("6222");
  });

  it("相同请求和审批快照哈希稳定，关键金额变化后哈希改变", async () => {
    const {
      buildPaymentApprovalSnapshot,
      buildPaymentRequestIntegrity,
      hashPaymentApprovalSnapshot,
      normalizePaymentEvidence,
    } = await import("./payment-integrity");
    const evidence = normalizePaymentEvidence(
      { name: "林小鹿", bank_name: "示例银行", account_number: "622200001234" },
      { exception_reason: "达人暂不提供发票，已由财务确认" },
    );
    const request = {
      contract_id: "contract-1",
      request_key: "request-1",
      amount_cents: 100_000,
      currency: "CNY",
      method: "bank",
      milestone_key: "final_delivery",
      milestone_label: "最终交付尾款",
      evidence,
    };
    expect(buildPaymentRequestIntegrity(request)).toEqual(buildPaymentRequestIntegrity(request));

    const snapshot = buildPaymentApprovalSnapshot({
      payment_id: "payment-1",
      payment_version: 1,
      requester_id: "user-1",
      amount_cents: 100_000,
      currency: "CNY",
      method: "bank",
      contract: {
        id: "contract-1",
        number: "HT-1",
        version: 1,
        status: "signed",
        amount_cents: 500_000,
        payment_terms: { text: "验收后付款" },
      },
      milestone: { key: "final_delivery", label: "最终交付尾款", snapshot: {} },
      payee: {
        name: evidence.payee.name,
        bank_name: evidence.payee.bank_name,
        account_last4: evidence.payee.account_last4,
        account_fingerprint: evidence.payee.account_fingerprint,
        fingerprint_version: evidence.payee.fingerprint_version,
      },
      invoice: evidence.invoice,
      reservation: { committed_cents: 100_000, remaining_cents: 400_000 },
    });
    expect(hashPaymentApprovalSnapshot(snapshot)).toBe(hashPaymentApprovalSnapshot(snapshot));
    expect(hashPaymentApprovalSnapshot({ ...snapshot, amount_cents: 100_001 })).not.toBe(
      hashPaymentApprovalSnapshot(snapshot),
    );
  });
});
