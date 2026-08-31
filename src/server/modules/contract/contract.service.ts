import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { checkpointRepository } from "@/server/modules/checkpoint/checkpoint.repository";
import { campaignRepository } from "@/server/modules/campaign/campaign.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { CONTRACT_STATUS, PAYMENT_STATUS, assertTransition } from "@/shared/constants/status";
import type { ContractDto, PaymentDto } from "@/shared/schemas/outreach";
import type { PaymentRecord } from "@/generated/prisma/client";
import {
  contractRepository,
  type ContractListParams,
  type ContractWithRelations,
  type PaymentWithContract,
} from "./contract.repository";

function jsonText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const text = record.text;
  return typeof text === "string" && text.trim() ? text : null;
}

function contractToDto(contract: ContractWithRelations): ContractDto {
  const paymentTotal = contract.payments
    .filter((payment) => !["cancelled", "failed"].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const paymentPaid = contract.payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  return {
    id: contract.id,
    campaign_creator_id: contract.campaignCreatorId,
    campaign_name: contract.campaignCreator.campaign.name,
    creator_name: contract.campaignCreator.creator.displayName,
    contract_number: contract.contractNumber,
    status: contract.status,
    version: contract.version,
    amount_cents: contract.amountCents,
    currency: contract.currency,
    usage_rights: jsonText(contract.usageRights),
    exclusivity_terms: jsonText(contract.exclusivityTerms),
    payment_terms: jsonText(contract.paymentTerms),
    signed_at: contract.signedAt?.toISOString() ?? null,
    payment_total_cents: paymentTotal,
    payment_paid_cents: paymentPaid,
    created_at: contract.createdAt.toISOString(),
  };
}

function paymentToDto(
  payment: PaymentRecord | PaymentWithContract,
  contract?: ContractWithRelations,
): PaymentDto {
  const relatedContract = "contract" in payment ? payment.contract : contract;
  return {
    id: payment.id,
    contract_id: payment.contractId,
    contract_number: relatedContract?.contractNumber ?? "",
    creator_name:
      relatedContract && "campaignCreator" in relatedContract
        ? relatedContract.campaignCreator.creator.displayName
        : "",
    status: payment.status,
    amount_cents: payment.amountCents,
    currency: payment.currency,
    method: payment.method,
    notes: jsonText(payment.invoice),
    paid_at: payment.paidAt?.toISOString() ?? null,
    approved_at: payment.approvedAt?.toISOString() ?? null,
    created_at: payment.createdAt.toISOString(),
  };
}

function contractNumber(): string {
  return `HT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export async function listContracts(
  ctx: TenantCtx,
  params: ContractListParams,
): Promise<{ items: ContractDto[]; pagination: Pagination }> {
  const rows = await contractRepository.listContracts(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(contractToDto), pagination };
}

export async function getContract(ctx: TenantCtx, id: string): Promise<ContractDto> {
  const contract = await contractRepository.findContract(ctx, id);
  if (!contract) throw new ApiError("RESOURCE_NOT_FOUND", "合同不存在");
  return contractToDto(contract);
}

export async function createContract(
  ctx: TenantCtx,
  input: {
    campaign_creator_id: string;
    amount_cents: number;
    usage_rights?: string | null;
    exclusivity_terms?: string | null;
    payment_terms?: string | null;
  },
): Promise<ContractDto> {
  const cc = await campaignRepository.findCampaignCreator(ctx, input.campaign_creator_id);
  if (!cc) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 达人不存在");
  if (!["confirmed", "contracting", "active"].includes(cc.status)) {
    throw new ApiError("CONFLICT", "需先确认合作条款后才能创建合同");
  }

  const existing = await contractRepository.findContractByCampaignCreator(
    ctx,
    input.campaign_creator_id,
  );
  if (existing) return contractToDto(existing);

  const contract = await contractRepository.createContract(ctx, {
    campaignCreatorId: input.campaign_creator_id,
    contractNumber: contractNumber(),
    amountCents: input.amount_cents,
    currency: cc.currency,
    usageRights: { text: input.usage_rights ?? "" },
    exclusivityTerms: { text: input.exclusivity_terms ?? "" },
    paymentTerms: { text: input.payment_terms ?? "" },
  });

  if (cc.status === "confirmed") {
    await campaignRepository.transitionCreatorField(
      ctx,
      cc.id,
      "status",
      "confirmed",
      "contracting",
      "合同已起草",
      "user",
    );
  }
  await campaignRepository.transitionCreatorField(
    ctx,
    cc.id,
    "contract_status",
    cc.contractStatus,
    "drafting",
    "合同已起草",
    "user",
  );

  return getContract(ctx, contract.id);
}

export async function transitionContractStatus(
  ctx: TenantCtx,
  contractId: string,
  to: string,
  reason?: string | null,
): Promise<ContractDto> {
  const contract = await contractRepository.findContract(ctx, contractId);
  if (!contract) throw new ApiError("RESOURCE_NOT_FOUND", "合同不存在");
  assertTransition(CONTRACT_STATUS, contract.status, to);
  if (contract.status === "in_review" && to === "sent") {
    throw new ApiError("CONFLICT", "请在审批中心批准合同，不能直接绕过审批门");
  }

  const extra: Record<string, unknown> = {};
  if (to === "signed") extra.signedAt = new Date();

  await contractRepository.transitionContract(
    ctx,
    contractId,
    contract.status,
    to,
    reason ?? null,
    extra,
  );

  if (to === "in_review") {
    await checkpointRepository.create(ctx, {
      type: "contract",
      status: "pending",
      title: `合同审批：${contract.campaignCreator.creator.displayName}`,
      summary: `合同 ${contract.contractNumber}，金额 ¥${(contract.amountCents / 100).toLocaleString("zh-CN")}`,
      entityType: "contract",
      entityId: contractId,
      payload: { contract_number: contract.contractNumber, amount_cents: contract.amountCents },
      priority: "high",
      assigneeRole: "manager",
    });
    await campaignRepository.transitionCreatorField(
      ctx,
      contract.campaignCreatorId,
      "contract_status",
      contract.campaignCreator.contractStatus,
      "in_review",
      "合同进入审批",
      "user",
    );
  }

  if (to === "signed") {
    await campaignRepository.transitionCreatorField(
      ctx,
      contract.campaignCreatorId,
      "contract_status",
      contract.campaignCreator.contractStatus,
      "signed",
      "合同已签署",
      "user",
    );
  }

  return getContract(ctx, contractId);
}

export async function onContractApprovalDecided(
  ctx: TenantCtx,
  contractId: string,
  decision: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  const contract = await contractRepository.findContract(ctx, contractId);
  if (!contract || contract.status !== "in_review") return;
  if (decision === "approved") {
    await contractRepository.transitionContract(
      ctx,
      contractId,
      "in_review",
      "sent",
      "合同审批通过",
    );
    await campaignRepository.transitionCreatorField(
      ctx,
      contract.campaignCreatorId,
      "contract_status",
      contract.campaignCreator.contractStatus,
      "sent",
      "合同审批通过并发送",
      "user",
    );
  } else {
    await contractRepository.transitionContract(
      ctx,
      contractId,
      "in_review",
      "draft",
      "合同审批驳回",
    );
    await campaignRepository.transitionCreatorField(
      ctx,
      contract.campaignCreatorId,
      "contract_status",
      contract.campaignCreator.contractStatus,
      "drafting",
      "合同审批驳回",
      "user",
    );
  }
}

export async function listPayments(ctx: TenantCtx, contractId: string): Promise<PaymentDto[]> {
  const contract = await contractRepository.findContract(ctx, contractId);
  if (!contract) throw new ApiError("RESOURCE_NOT_FOUND", "合同不存在");
  const payments = await contractRepository.listPayments(ctx, contractId);
  return payments.map((payment) => paymentToDto(payment, contract));
}

export async function createPayment(
  ctx: TenantCtx,
  contractId: string,
  input: {
    amount_cents: number;
    method?: "bank" | "alipay" | "other" | null;
    notes?: string | null;
  },
): Promise<PaymentDto> {
  const contract = await contractRepository.findContract(ctx, contractId);
  if (!contract) throw new ApiError("RESOURCE_NOT_FOUND", "合同不存在");
  if (!["signed", "active"].includes(contract.status)) {
    throw new ApiError("CONFLICT", "仅已签署或生效合同可登记付款；预付款需走单独的例外审批流程");
  }
  const committedTotal = contract.payments
    .filter((payment) => !["cancelled", "failed"].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const remainingCents = Math.max(0, contract.amountCents - committedTotal);
  if (input.amount_cents > remainingCents) {
    throw new ApiError(
      "CONFLICT",
      `付款金额超过合同剩余可付金额 ¥${(remainingCents / 100).toLocaleString("zh-CN")}`,
    );
  }
  const payment = await contractRepository.createPayment(ctx, {
    contractId,
    amountCents: input.amount_cents,
    currency: contract.currency,
    method: input.method ?? null,
    invoice: { text: input.notes ?? "" },
  });
  return paymentToDto(payment, contract);
}

export async function transitionPaymentStatus(
  ctx: TenantCtx,
  paymentId: string,
  to: string,
  reason?: string | null,
): Promise<PaymentDto> {
  const payment = await contractRepository.findPayment(ctx, paymentId);
  if (!payment) throw new ApiError("RESOURCE_NOT_FOUND", "付款记录不存在");
  assertTransition(PAYMENT_STATUS, payment.status, to);
  if (payment.status === "pending_approval" && to === "approved") {
    throw new ApiError("CONFLICT", "请在审批中心批准付款，不能直接绕过审批门");
  }

  const extra: Record<string, unknown> = {};
  if (to === "approved") {
    extra.approvedAt = new Date();
    extra.approvedBy = ctx.userId ?? null;
  }
  if (to === "paid") extra.paidAt = new Date();

  await contractRepository.transitionPayment(
    ctx,
    paymentId,
    payment.status,
    to,
    reason ?? null,
    extra,
  );

  if (to === "pending_approval") {
    await checkpointRepository.create(ctx, {
      type: "payment",
      status: "pending",
      title: `付款审批：${payment.contract.campaignCreator.creator.displayName}`,
      summary: `付款金额 ¥${(payment.amountCents / 100).toLocaleString("zh-CN")}`,
      entityType: "payment_record",
      entityId: paymentId,
      payload: { contract_id: payment.contractId, amount_cents: payment.amountCents },
      priority: "high",
      assigneeRole: "finance",
    });
  }

  if (to === "paid") {
    const contract = await contractRepository.findContract(ctx, payment.contractId);
    if (contract) {
      const paidTotal = await contractRepository.paidTotal(ctx, contract.id);
      const nextPaymentStatus = paidTotal >= contract.amountCents ? "paid" : "partial";
      await campaignRepository.transitionCreatorField(
        ctx,
        contract.campaignCreatorId,
        "payment_status",
        contract.campaignCreator.paymentStatus,
        nextPaymentStatus,
        "付款状态更新",
        "user",
      );
    }
  }

  const updated = await contractRepository.findPayment(ctx, paymentId);
  return paymentToDto(updated!);
}

export async function onPaymentApprovalDecided(
  ctx: TenantCtx,
  paymentId: string,
  decision: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  const payment = await contractRepository.findPayment(ctx, paymentId);
  if (!payment || payment.status !== "pending_approval") return;
  if (decision === "approved") {
    await contractRepository.transitionPayment(
      ctx,
      paymentId,
      "pending_approval",
      "approved",
      "付款审批通过",
      {
        approvedAt: new Date(),
        approvedBy: ctx.userId ?? null,
      },
    );
  } else {
    await contractRepository.transitionPayment(
      ctx,
      paymentId,
      "pending_approval",
      "cancelled",
      "付款审批驳回",
    );
  }
}
