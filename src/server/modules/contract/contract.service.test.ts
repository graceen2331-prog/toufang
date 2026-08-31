import { beforeEach, describe, expect, it, vi } from "vitest";

const findContract = vi.fn();
const transitionContract = vi.fn();
const findPayment = vi.fn();
const transitionPayment = vi.fn();
const createPayment = vi.fn();

vi.mock("./contract.repository", () => ({
  contractRepository: {
    findContract,
    transitionContract,
    findPayment,
    transitionPayment,
    createPayment,
  },
}));

vi.mock("@/server/modules/checkpoint/checkpoint.repository", () => ({
  checkpointRepository: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/modules/campaign/campaign.repository", () => ({
  campaignRepository: {
    findCampaignCreator: vi.fn(),
    transitionCreatorField: vi.fn(),
  },
}));

const campaignCreator = {
  id: "cc-1",
  tenantId: "org-1",
  campaignId: "campaign-1",
  creatorId: "creator-1",
  status: "contracting",
  contractStatus: "in_review",
  paymentStatus: "pending",
  contentStatus: "none",
  role: null,
  matchScore: null,
  quotedPriceCents: null,
  agreedPriceCents: null,
  currency: "CNY",
  deliverables: [],
  aiGenerated: false,
  createdAt: new Date("2026-07-04T00:00:00.000Z"),
  updatedAt: new Date("2026-07-04T00:00:00.000Z"),
  createdBy: "user-1",
  updatedBy: null,
  deletedAt: null,
  campaign: { id: "campaign-1", name: "双十一 Campaign" },
  creator: { id: "creator-1", displayName: "林小鹿" },
};

const contract = {
  id: "contract-1",
  tenantId: "org-1",
  campaignCreatorId: "cc-1",
  contractNumber: "HT-20260704-TEST",
  status: "in_review",
  version: 1,
  amountCents: 5_000_000,
  currency: "CNY",
  usageRights: { text: "30 天内容授权" },
  exclusivityTerms: { text: "" },
  paymentTerms: { text: "验收后 7 日付款" },
  fileId: null,
  signedAt: null,
  createdAt: new Date("2026-07-04T00:00:00.000Z"),
  updatedAt: new Date("2026-07-04T00:00:00.000Z"),
  createdBy: "user-1",
  updatedBy: null,
  deletedAt: null,
  payments: [],
  campaignCreator,
};

const payment = {
  id: "payment-1",
  tenantId: "org-1",
  contractId: "contract-1",
  status: "pending_approval",
  amountCents: 2_000_000,
  currency: "CNY",
  method: "bank",
  accountInfo: {},
  invoice: { text: "首付款" },
  paidAt: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date("2026-07-04T00:00:00.000Z"),
  updatedAt: new Date("2026-07-04T00:00:00.000Z"),
  createdBy: "user-1",
  updatedBy: null,
  deletedAt: null,
  contract: {
    ...contract,
    campaignCreator: {
      ...campaignCreator,
      creator: { displayName: "林小鹿" },
    },
  },
};

describe("合同与付款审批门", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("不允许绕过审批中心直接把审核中合同标记为已发送", async () => {
    findContract.mockResolvedValue(contract);

    const { transitionContractStatus } = await import("./contract.service");

    await expect(
      transitionContractStatus({ orgId: "org-1", userId: "user-1" }, "contract-1", "sent"),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(transitionContract).not.toHaveBeenCalled();
  });

  it("不允许绕过审批中心直接把待审批付款标记为已批准", async () => {
    findPayment.mockResolvedValue(payment);

    const { transitionPaymentStatus } = await import("./contract.service");

    await expect(
      transitionPaymentStatus({ orgId: "org-1", userId: "user-1" }, "payment-1", "approved"),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(transitionPayment).not.toHaveBeenCalled();
  });

  it("已发送但未签署的合同不可登记付款", async () => {
    findContract.mockResolvedValue({ ...contract, status: "sent" });
    const { createPayment: create } = await import("./contract.service");

    await expect(
      create({ orgId: "org-1", userId: "user-1" }, "contract-1", { amount_cents: 100_000 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("付款金额不可超过合同剩余可付金额", async () => {
    findContract.mockResolvedValue({
      ...contract,
      status: "signed",
      payments: [
        { ...payment, status: "approved", amountCents: 4_500_000 },
        { ...payment, id: "cancelled-payment", status: "cancelled", amountCents: 2_000_000 },
      ],
    });
    const { createPayment: create } = await import("./contract.service");

    await expect(
      create({ orgId: "org-1", userId: "user-1" }, "contract-1", { amount_cents: 600_000 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("已签署合同可在剩余额度内登记付款", async () => {
    findContract.mockResolvedValue({ ...contract, status: "signed", payments: [] });
    createPayment.mockResolvedValue({ ...payment, status: "not_started", amountCents: 500_000 });
    const { createPayment: create } = await import("./contract.service");

    await expect(
      create({ orgId: "org-1", userId: "user-1" }, "contract-1", {
        amount_cents: 500_000,
        method: "bank",
      }),
    ).resolves.toMatchObject({ amount_cents: 500_000, status: "not_started" });
    expect(createPayment).toHaveBeenCalledWith(
      { orgId: "org-1", userId: "user-1" },
      expect.objectContaining({ contractId: "contract-1", amountCents: 500_000 }),
    );
  });
});
