import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { checkpointRepository } from "@/server/modules/checkpoint/checkpoint.repository";
import { campaignRepository } from "@/server/modules/campaign/campaign.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { decryptJson, encryptJson } from "@/server/lib/crypto";
import { CONTRACT_STATUS, PAYMENT_STATUS, assertTransition } from "@/shared/constants/status";
import type {
  ContractDto,
  PaymentCreateInput,
  PaymentDto,
  PaymentReconcileInput,
} from "@/shared/schemas/outreach";
import type { CheckpointDecisionInput } from "@/shared/schemas/checkpoint";
import type { PaymentRecord } from "@/generated/prisma/client";
import {
  contractRepository,
  type ContractListParams,
  type ContractWithRelations,
  type PaymentWithContract,
} from "./contract.repository";
import {
  buildPaymentRequestIntegrity,
  normalizePaymentEvidence,
} from "./payment-integrity";

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
  const account = decryptJson<{ bank_name?: string }>(payment.accountInfo);
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
    version: payment.version,
    milestone_key: payment.milestoneKey,
    milestone_label: payment.milestoneLabel,
    payee_name: payment.payeeNameSnapshot,
    payee_bank_name: account?.bank_name ?? null,
    payee_account_last4: payment.payeeAccountLast4,
    invoice_number: payment.invoiceNumber,
    invoice_issuer: payment.invoiceIssuer,
    invoice_exception_reason: payment.invoiceExceptionReason,
    approval_checkpoint_id: payment.approvalCheckpointId,
    approval_snapshot_hash: payment.approvalSnapshotHash,
    reconciliation_reference: payment.reconciliationReference,
    reconciliation_evidence_present: Boolean(payment.reconciliationHash),
    paid_by: payment.paidBy,
    legacy_evidence_incomplete: Boolean(
      !payment.requestKey ||
        !payment.milestoneKey ||
        !payment.payeeAccountFingerprint ||
        (!payment.invoiceNumber && !payment.invoiceExceptionReason),
    ),
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

  const transitioned = await contractRepository.transitionContract(
    ctx,
    contractId,
    contract.status,
    to,
    reason ?? null,
    extra,
  );
  if (transitioned === false) throw new ApiError("CONFLICT", "合同状态已变化，请刷新后重试");

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
    const transitioned = await contractRepository.transitionContract(
      ctx,
      contractId,
      "in_review",
      "sent",
      "合同审批通过",
    );
    if (transitioned === false) return;
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
    const transitioned = await contractRepository.transitionContract(
      ctx,
      contractId,
      "in_review",
      "draft",
      "合同审批驳回",
    );
    if (transitioned === false) return;
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
  input: PaymentCreateInput,
): Promise<PaymentDto> {
  const contract = await contractRepository.findContract(ctx, contractId);
  if (!contract) throw new ApiError("RESOURCE_NOT_FOUND", "合同不存在");
  if (!["signed", "active"].includes(contract.status)) {
    throw new ApiError(
      "CONTRACT_NOT_PAYABLE",
      "仅已签署或生效合同可申请付款；暂不支持未签署合同预付款例外",
    );
  }
  if (input.currency !== contract.currency) {
    throw new ApiError("VALIDATION_FAILED", "付款币种必须与合同币种一致");
  }
  const evidence = normalizePaymentEvidence(input.payee, input.invoice);
  const integrity = buildPaymentRequestIntegrity({
    contract_id: contractId,
    request_key: input.request_key,
    amount_cents: input.amount_cents,
    currency: input.currency,
    method: input.method,
    milestone_key: input.milestone_key,
    milestone_label: input.milestone_label,
    evidence,
  });
  const result = await contractRepository.createPaymentWithReservation({
    ctx,
    contractId,
    requestKey: input.request_key,
    requestHash: integrity.requestHash,
    dedupeFingerprint: integrity.dedupeFingerprint,
    data: {
      amountCents: input.amount_cents,
      currency: input.currency,
      method: input.method,
      accountInfo: encryptJson({
        payee_name: evidence.payee.name,
        bank_name: evidence.payee.bank_name,
        account_number: evidence.payee.account_number,
      }) as object,
      invoice: { text: input.notes ?? "" },
      milestoneKey: input.milestone_key,
      milestoneLabel: input.milestone_label,
      milestoneSnapshot: {
        contract_version: contract.version,
        payment_terms: contract.paymentTerms,
      },
      payeeNameSnapshot: evidence.payee.name,
      payeeAccountFingerprint: evidence.payee.account_fingerprint,
      payeeAccountFingerprintVersion: evidence.payee.fingerprint_version,
      payeeAccountLast4: evidence.payee.account_last4,
      invoiceNumber: evidence.invoice.number,
      invoiceIssuer: evidence.invoice.issuer,
      invoiceAmountCents: evidence.invoice.amount_cents,
      invoiceCurrency: evidence.invoice.currency,
      invoiceExceptionReason: evidence.invoice.exception_reason,
      invoiceFingerprint: evidence.invoice.fingerprint,
    },
  });
  if (result.kind === "not_found") throw new ApiError("RESOURCE_NOT_FOUND", "合同不存在");
  if (result.kind === "not_payable") throw new ApiError("CONTRACT_NOT_PAYABLE");
  if (result.kind === "currency_mismatch") {
    throw new ApiError("VALIDATION_FAILED", "付款币种必须与合同币种一致");
  }
  if (result.kind === "request_key_reused") throw new ApiError("PAYMENT_REQUEST_KEY_REUSED");
  if (result.kind === "duplicate") {
    throw new ApiError("PAYMENT_DUPLICATE", undefined, { payment_id: result.paymentId });
  }
  if (result.kind === "limit_exceeded") {
    throw new ApiError(
      "PAYMENT_LIMIT_EXCEEDED",
      `付款金额超过合同剩余可付金额 ¥${(result.remainingCents / 100).toLocaleString("zh-CN")}`,
      { remaining_cents: result.remainingCents },
    );
  }
  return paymentToDto(result.payment, contract);
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
  if (to === "paid") {
    throw new ApiError(
      "PAYMENT_RECONCILIATION_REQUIRED",
      "请使用“登记付款与对账”填写流水和证据，不能直接标记已付款",
    );
  }

  if (to === "pending_approval") {
    const submitted = await contractRepository.submitPaymentForApproval({
      ctx,
      paymentId,
      expectedVersion: payment.version,
    });
    if (submitted.kind === "not_found") throw new ApiError("RESOURCE_NOT_FOUND", "付款记录不存在");
    if (submitted.kind === "not_payable") throw new ApiError("CONTRACT_NOT_PAYABLE");
    if (submitted.kind !== "submitted") throw new ApiError("PAYMENT_STATUS_CONFLICT");
  } else {
    const transitioned = await contractRepository.transitionPayment(
      ctx,
      paymentId,
      payment.status,
      to,
      reason ?? null,
    );
    if (!transitioned) throw new ApiError("PAYMENT_STATUS_CONFLICT");
  }

  const updated = await contractRepository.findPayment(ctx, paymentId);
  return paymentToDto(updated!);
}

export async function decidePaymentCheckpoint(
  ctx: TenantCtx,
  checkpointId: string,
  decision: "approved" | "rejected" | "changes_requested",
  reason: string | null,
  confirmation: CheckpointDecisionInput["payment_confirmation"],
  canApprovePayment: boolean,
): Promise<void> {
  const result = await contractRepository.decidePaymentCheckpoint({
    ctx,
    checkpointId,
    decision,
    reason,
    canApprovePayment,
    ...(confirmation ? { confirmation } : {}),
  });
  if (result.kind === "decided") return;
  if (result.kind === "not_pending") throw new ApiError("APPROVAL_ALREADY_DECIDED");
  if (result.kind === "permission_denied") throw new ApiError("PERMISSION_DENIED", "缺少付款审批权限");
  if (result.kind === "self_approval") throw new ApiError("PAYMENT_SELF_APPROVAL_FORBIDDEN");
  if (result.kind === "not_payable") throw new ApiError("CONTRACT_NOT_PAYABLE");
  if (result.kind === "confirmation_required") {
    throw new ApiError("VALIDATION_FAILED", "批准付款前必须人工核对收款账户和发票/免票依据", {
      snapshot_hash: result.snapshotHash,
    });
  }
  if (result.kind === "snapshot_mismatch") {
    throw new ApiError("PAYMENT_APPROVAL_SNAPSHOT_MISMATCH");
  }
  throw new ApiError("PAYMENT_STATUS_CONFLICT");
}

export async function reconcilePayment(
  ctx: TenantCtx,
  paymentId: string,
  input: PaymentReconcileInput,
): Promise<PaymentDto> {
  const result = await contractRepository.reconcilePayment({
    ctx,
    paymentId,
    settlementRequestKey: input.settlement_request_key,
    reconciliationReference: input.reconciliation_reference.trim(),
    paidAt: new Date(input.paid_at),
    evidenceNote: input.evidence_note.trim(),
    evidenceDocumentRef: input.evidence_document_ref?.trim() || null,
  });
  if (result.kind === "not_found") throw new ApiError("RESOURCE_NOT_FOUND", "付款记录不存在");
  if (result.kind === "status_conflict") throw new ApiError("PAYMENT_STATUS_CONFLICT");
  if (result.kind === "approval_required") {
    throw new ApiError("PAYMENT_APPROVED_CHECKPOINT_REQUIRED");
  }
  if (result.kind === "snapshot_mismatch") {
    throw new ApiError("PAYMENT_APPROVAL_SNAPSHOT_MISMATCH");
  }
  if (result.kind === "settlement_key_reused") throw new ApiError("PAYMENT_REQUEST_KEY_REUSED");
  if (result.kind === "reconciliation_duplicate") {
    throw new ApiError("RECONCILIATION_REFERENCE_DUPLICATE");
  }
  const payment = await contractRepository.findPayment(ctx, result.payment.id);
  return paymentToDto(payment!);
}
