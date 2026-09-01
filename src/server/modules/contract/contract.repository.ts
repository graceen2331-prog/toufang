import "server-only";
import { prisma } from "@/server/db/client";
import type { CampaignCreator, Contract, PaymentRecord, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";
import { decryptJson } from "@/server/lib/crypto";
import { PAYMENT_STATUS, assertTransition } from "@/shared/constants/status";
import {
  PAYMENT_HASH_ALGORITHM,
  buildPaymentApprovalSnapshot,
  buildReconciliationEvidence,
  hashPaymentApprovalSnapshot,
  type PaymentApprovalSnapshot,
} from "./payment-integrity";

export interface ContractListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  campaignId: string | null;
}

const contractInclude = {
  payments: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ContractInclude;

type ContractRow = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

export type ContractWithRelations = ContractRow & {
  campaignCreator: CampaignCreator & {
    campaign: { id: string; name: string };
    creator: { id: string; displayName: string };
  };
};

export type PaymentWithContract = PaymentRecord & {
  contract: Contract & {
    campaignCreator: CampaignCreator & {
      creator: { displayName: string };
    };
  };
};

async function hydrateContracts(ctx: TenantCtx, rows: ContractRow[]): Promise<ContractWithRelations[]> {
  if (rows.length === 0) return [];
  const campaignCreatorIds = [...new Set(rows.map((row) => row.campaignCreatorId))];
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { id: { in: campaignCreatorIds }, tenantId: ctx.orgId, deletedAt: null },
    include: {
      campaign: { select: { id: true, name: true } },
      creator: { select: { id: true, displayName: true } },
    },
  });
  const byId = new Map(campaignCreators.map((cc) => [cc.id, cc]));
  return rows.map((row) => {
    const campaignCreator = byId.get(row.campaignCreatorId);
    if (!campaignCreator) {
      throw new Error(`contract ${row.id} 缺少 campaign_creator ${row.campaignCreatorId}`);
    }
    return { ...row, campaignCreator };
  });
}

type PaymentAccountEnvelope = { bank_name?: string };

function paymentSnapshot(
  payment: PaymentRecord,
  contract: Contract,
  reservation: { committed_cents: number; remaining_cents: number },
): PaymentApprovalSnapshot {
  const account = decryptJson<PaymentAccountEnvelope>(payment.accountInfo);
  return buildPaymentApprovalSnapshot({
    payment_id: payment.id,
    payment_version: payment.version,
    requester_id: payment.createdBy,
    amount_cents: payment.amountCents,
    currency: payment.currency,
    method: payment.method,
    contract: {
      id: contract.id,
      number: contract.contractNumber,
      version: contract.version,
      status: contract.status,
      amount_cents: contract.amountCents,
      payment_terms: contract.paymentTerms,
    },
    milestone: {
      key: payment.milestoneKey,
      label: payment.milestoneLabel,
      snapshot: payment.milestoneSnapshot,
    },
    payee: {
      name: payment.payeeNameSnapshot,
      bank_name: account?.bank_name ?? null,
      account_last4: payment.payeeAccountLast4,
      account_fingerprint: payment.payeeAccountFingerprint,
      fingerprint_version: payment.payeeAccountFingerprintVersion,
    },
    invoice: {
      number: payment.invoiceNumber,
      issuer: payment.invoiceIssuer,
      amount_cents: payment.invoiceAmountCents,
      currency: payment.invoiceCurrency,
      exception_reason: payment.invoiceExceptionReason,
      fingerprint: payment.invoiceFingerprint,
    },
    reservation,
  });
}

async function lockContract(
  tx: Prisma.TransactionClient,
  tenantId: string,
  contractId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "contracts"
    WHERE "id" = ${contractId}
      AND "tenant_id" = ${tenantId}
      AND "deleted_at" IS NULL
    FOR UPDATE
  `;
  return rows.length === 1;
}

async function syncCampaignPaymentStatus(
  tx: Prisma.TransactionClient,
  input: { ctx: TenantCtx; contract: Contract; reason: string },
): Promise<void> {
  const current = await tx.campaignCreator.findFirst({
    where: {
      id: input.contract.campaignCreatorId,
      tenantId: input.ctx.orgId,
      deletedAt: null,
    },
    select: { paymentStatus: true },
  });
  if (!current) throw new Error("Campaign 达人不存在");
  const payments = await tx.paymentRecord.findMany({
    where: {
      tenantId: input.ctx.orgId,
      contractId: input.contract.id,
      deletedAt: null,
    },
    select: { status: true, amountCents: true },
  });
  const paidCents = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const hasReserved = payments.some(
    (payment) => !["cancelled", "failed"].includes(payment.status),
  );
  const target =
    paidCents >= input.contract.amountCents
      ? "paid"
      : paidCents > 0
        ? "partial"
        : hasReserved
          ? "pending"
          : "none";
  if (current.paymentStatus === target) return;
  const updated = await tx.campaignCreator.updateMany({
    where: {
      id: input.contract.campaignCreatorId,
      tenantId: input.ctx.orgId,
      deletedAt: null,
      paymentStatus: current.paymentStatus,
    },
    data: { paymentStatus: target, updatedBy: input.ctx.userId ?? null },
  });
  if (updated.count !== 1) throw new Error("Campaign 付款汇总状态已变化");
  await recordStatusEvent(
    {
      tenantId: input.ctx.orgId,
      entityType: "campaign_creator",
      entityId: input.contract.campaignCreatorId,
      field: "payment_status",
      fromValue: current.paymentStatus,
      toValue: target,
      actorId: input.ctx.userId ?? null,
      reason: input.reason,
    },
    tx,
  );
}

export const contractRepository = {
  async listContracts(ctx: TenantCtx, params: ContractListParams): Promise<ContractWithRelations[]> {
    let campaignCreatorIds: string[] | null = null;
    if (params.campaignId) {
      const campaignCreators = await prisma.campaignCreator.findMany({
        where: { tenantId: ctx.orgId, campaignId: params.campaignId, deletedAt: null },
        select: { id: true },
      });
      campaignCreatorIds = campaignCreators.map((cc) => cc.id);
      if (campaignCreatorIds.length === 0) return [];
    }

    const rows = await prisma.contract.findMany({
      where: {
        tenantId: ctx.orgId,
        deletedAt: null,
        ...(params.status ? { status: params.status } : {}),
        ...(campaignCreatorIds ? { campaignCreatorId: { in: campaignCreatorIds } } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
      },
      include: contractInclude,
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
    return hydrateContracts(ctx, rows);
  },

  async findContract(ctx: TenantCtx, id: string): Promise<ContractWithRelations | null> {
    const row = await prisma.contract.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: contractInclude,
    });
    if (!row) return null;
    return (await hydrateContracts(ctx, [row]))[0] ?? null;
  },

  async findContractByCampaignCreator(ctx: TenantCtx, campaignCreatorId: string) {
    const row = await prisma.contract.findFirst({
      where: { tenantId: ctx.orgId, campaignCreatorId, deletedAt: null },
      include: contractInclude,
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    return (await hydrateContracts(ctx, [row]))[0] ?? null;
  },

  async createContract(
    ctx: TenantCtx,
    data: Omit<Prisma.ContractUncheckedCreateInput, "tenantId">,
  ): Promise<Contract> {
    return prisma.contract.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async transitionContract(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.ContractUncheckedUpdateInput = {},
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.contract.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null, status: fromValue },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      if (updated.count !== 1) return false;
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "contract",
          entityId: id,
          fromValue,
          toValue,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
      return true;
    });
  },

  async listPayments(ctx: TenantCtx, contractId: string): Promise<PaymentRecord[]> {
    return prisma.paymentRecord.findMany({
      where: { tenantId: ctx.orgId, contractId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async findPayment(ctx: TenantCtx, id: string): Promise<PaymentWithContract | null> {
    const row = await prisma.paymentRecord.findFirst({
      where: { id, tenantId: ctx.orgId, deletedAt: null },
      include: { contract: true },
    });
    if (!row) return null;
    const campaignCreator = await prisma.campaignCreator.findFirst({
      where: { id: row.contract.campaignCreatorId, tenantId: ctx.orgId, deletedAt: null },
      include: { creator: { select: { displayName: true } } },
    });
    if (!campaignCreator) {
      throw new Error(`payment ${row.id} 缺少 campaign_creator ${row.contract.campaignCreatorId}`);
    }
    return { ...row, contract: { ...row.contract, campaignCreator } };
  },

  async createPaymentWithReservation(input: {
    ctx: TenantCtx;
    contractId: string;
    requestKey: string;
    requestHash: string;
    dedupeFingerprint: string;
    data: Omit<Prisma.PaymentRecordUncheckedCreateInput, "tenantId" | "contractId">;
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.paymentRecord.findFirst({
          where: { tenantId: input.ctx.orgId, requestKey: input.requestKey },
        });
        if (existing) {
          return existing.requestHash === input.requestHash
            ? { kind: "created" as const, payment: existing, reused: true }
            : { kind: "request_key_reused" as const };
        }
        if (!(await lockContract(tx, input.ctx.orgId, input.contractId))) {
          return { kind: "not_found" as const };
        }
        const contract = await tx.contract.findFirst({
          where: {
            id: input.contractId,
            tenantId: input.ctx.orgId,
            deletedAt: null,
          },
        });
        if (!contract) return { kind: "not_found" as const };
        if (!["signed", "active"].includes(contract.status)) {
          return { kind: "not_payable" as const };
        }
        if (input.data.currency !== contract.currency) {
          return { kind: "currency_mismatch" as const };
        }
        const committed = await tx.paymentRecord.aggregate({
          where: {
            tenantId: input.ctx.orgId,
            contractId: contract.id,
            deletedAt: null,
            status: { notIn: ["cancelled", "failed"] },
          },
          _sum: { amountCents: true },
        });
        const committedCents = committed._sum.amountCents ?? 0;
        const nextTotal = committedCents + Number(input.data.amountCents);
        if (nextTotal > contract.amountCents) {
          return {
            kind: "limit_exceeded" as const,
            remainingCents: Math.max(0, contract.amountCents - committedCents),
          };
        }
        const payment = await tx.paymentRecord.create({
          data: {
            ...input.data,
            tenantId: input.ctx.orgId,
            contractId: contract.id,
            requestKey: input.requestKey,
            requestHash: input.requestHash,
            dedupeFingerprint: input.dedupeFingerprint,
            createdBy: input.ctx.userId ?? null,
          },
        });
        await recordStatusEvent(
          {
            tenantId: input.ctx.orgId,
            entityType: "payment_record",
            entityId: payment.id,
            fromValue: null,
            toValue: payment.status,
            actorId: input.ctx.userId ?? null,
            reason: "创建付款申请并预留合同额度",
            metadata: { request_key: input.requestKey, contract_id: contract.id },
          },
          tx,
        );
        await syncCampaignPaymentStatus(tx, {
          ctx: input.ctx,
          contract,
          reason: "付款申请已预留额度",
        });
        return { kind: "created" as const, payment, reused: false };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const existing = await prisma.paymentRecord.findFirst({
          where: { tenantId: input.ctx.orgId, requestKey: input.requestKey },
        });
        if (existing) {
          return existing.requestHash === input.requestHash
            ? { kind: "created" as const, payment: existing, reused: true }
            : { kind: "request_key_reused" as const };
        }
        const duplicate = await prisma.paymentRecord.findFirst({
          where: {
            tenantId: input.ctx.orgId,
            dedupeFingerprint: input.dedupeFingerprint,
            deletedAt: null,
            status: { notIn: ["cancelled", "failed"] },
          },
        });
        if (duplicate) return { kind: "duplicate" as const, paymentId: duplicate.id };
      }
      throw error;
    }
  },

  async transitionPayment(
    ctx: TenantCtx,
    id: string,
    fromValue: string,
    toValue: string,
    reason: string | null,
    extra: Prisma.PaymentRecordUncheckedUpdateInput = {},
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.paymentRecord.findFirst({
        where: { id, tenantId: ctx.orgId, deletedAt: null, status: fromValue },
        include: { contract: true },
      });
      if (!payment || !(await lockContract(tx, ctx.orgId, payment.contractId))) return false;
      const updated = await tx.paymentRecord.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null, status: fromValue },
        data: { status: toValue, updatedBy: ctx.userId ?? null, ...extra },
      });
      if (updated.count !== 1) return false;
      await recordStatusEvent(
        {
          tenantId: ctx.orgId,
          entityType: "payment_record",
          entityId: id,
          fromValue,
          toValue,
          actorId: ctx.userId ?? null,
          reason,
        },
        tx,
      );
      await syncCampaignPaymentStatus(tx, {
        ctx,
        contract: payment.contract,
        reason: reason ?? "付款状态更新",
      });
      return true;
    });
  },

  async submitPaymentForApproval(input: {
    ctx: TenantCtx;
    paymentId: string;
    expectedVersion: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const initial = await tx.paymentRecord.findFirst({
        where: { id: input.paymentId, tenantId: input.ctx.orgId, deletedAt: null },
      });
      if (!initial) return { kind: "not_found" as const };
      if (!(await lockContract(tx, input.ctx.orgId, initial.contractId))) {
        return { kind: "not_found" as const };
      }
      const payment = await tx.paymentRecord.findFirst({
        where: {
          id: input.paymentId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: "not_started",
          version: input.expectedVersion,
        },
      });
      if (!payment) return { kind: "status_conflict" as const };
      const contract = await tx.contract.findFirst({
        where: {
          id: payment.contractId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
        },
      });
      if (!contract || !["signed", "active"].includes(contract.status)) {
        return { kind: "not_payable" as const };
      }
      const committed = await tx.paymentRecord.aggregate({
        where: {
          tenantId: input.ctx.orgId,
          contractId: contract.id,
          deletedAt: null,
          status: { notIn: ["cancelled", "failed"] },
        },
        _sum: { amountCents: true },
      });
      const committedCents = committed._sum.amountCents ?? 0;
      const snapshot = paymentSnapshot({ ...payment, version: payment.version + 1 }, contract, {
        committed_cents: committedCents,
        remaining_cents: Math.max(0, contract.amountCents - committedCents),
      });
      const snapshotHash = hashPaymentApprovalSnapshot(snapshot);
      const checkpoint = await tx.humanCheckpoint.create({
        data: {
          tenantId: input.ctx.orgId,
          type: "payment",
          status: "pending",
          title: `付款审批：${payment.payeeNameSnapshot ?? contract.contractNumber}`,
          summary: `付款金额 ¥${(payment.amountCents / 100).toLocaleString("zh-CN")}`,
          entityType: "payment_record",
          entityId: payment.id,
          payload: {
            contract_id: contract.id,
            amount_cents: payment.amountCents,
            snapshot,
            snapshot_hash: snapshotHash,
            hash_algorithm: PAYMENT_HASH_ALGORITHM,
          } as unknown as Prisma.InputJsonValue,
          priority: "high",
          assigneeRole: "finance",
          createdBy: input.ctx.userId ?? null,
        },
      });
      const updated = await tx.paymentRecord.updateMany({
        where: {
          id: payment.id,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: "not_started",
          version: input.expectedVersion,
        },
        data: {
          status: "pending_approval",
          version: { increment: 1 },
          approvalCheckpointId: checkpoint.id,
          approvalSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          approvalSnapshotHash: snapshotHash,
          approvalHashAlgorithm: PAYMENT_HASH_ALGORITHM,
          updatedBy: input.ctx.userId ?? null,
        },
      });
      if (updated.count !== 1) throw new Error("付款申请状态已变化");
      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: "payment_record",
          entityId: payment.id,
          fromValue: "not_started",
          toValue: "pending_approval",
          actorId: input.ctx.userId ?? null,
          reason: "付款申请提交审批",
          metadata: { checkpoint_id: checkpoint.id, snapshot_hash: snapshotHash },
        },
        tx,
      );
      await syncCampaignPaymentStatus(tx, {
        ctx: input.ctx,
        contract,
        reason: "付款申请进入审批",
      });
      const result = await tx.paymentRecord.findUnique({ where: { id: payment.id } });
      return { kind: "submitted" as const, payment: result!, checkpointId: checkpoint.id };
    });
  },

  async decidePaymentCheckpoint(input: {
    ctx: TenantCtx;
    checkpointId: string;
    decision: "approved" | "rejected" | "changes_requested";
    reason: string | null;
    canApprovePayment: boolean;
    confirmation?: {
      account_manually_checked: true;
      invoice_manually_checked: true;
      snapshot_hash: string;
    };
  }) {
    return prisma.$transaction(async (tx) => {
      const checkpoint = await tx.humanCheckpoint.findFirst({
        where: {
          id: input.checkpointId,
          tenantId: input.ctx.orgId,
          type: "payment",
          entityType: "payment_record",
          status: "pending",
        },
      });
      if (!checkpoint?.entityId) return { kind: "not_pending" as const };
      const initialPayment = await tx.paymentRecord.findFirst({
        where: {
          id: checkpoint.entityId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: "pending_approval",
          approvalCheckpointId: checkpoint.id,
        },
        select: { contractId: true },
      });
      if (!initialPayment) return { kind: "status_conflict" as const };
      if (!(await lockContract(tx, input.ctx.orgId, initialPayment.contractId))) {
        return { kind: "status_conflict" as const };
      }
      const payment = await tx.paymentRecord.findFirst({
        where: {
          id: checkpoint.entityId,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: "pending_approval",
          approvalCheckpointId: checkpoint.id,
        },
        include: { contract: true },
      });
      if (!payment) return { kind: "status_conflict" as const };
      assertTransition(
        PAYMENT_STATUS,
        payment.status,
        input.decision === "approved"
          ? "approved"
          : input.decision === "changes_requested"
            ? "not_started"
            : "cancelled",
      );
      if (input.decision === "approved" && !input.canApprovePayment) {
        return { kind: "permission_denied" as const };
      }
      if (
        input.decision === "approved" &&
        payment.createdBy &&
        payment.createdBy === input.ctx.userId
      ) {
        return { kind: "self_approval" as const };
      }
      if (!["signed", "active"].includes(payment.contract.status)) {
        return { kind: "not_payable" as const };
      }
      const payload =
        checkpoint.payload && typeof checkpoint.payload === "object" && !Array.isArray(checkpoint.payload)
          ? (checkpoint.payload as Record<string, unknown>)
          : {};
      const storedSnapshot = payment.approvalSnapshot as unknown as PaymentApprovalSnapshot;
      const storedHash = hashPaymentApprovalSnapshot(storedSnapshot);
      const currentHash = hashPaymentApprovalSnapshot(
        paymentSnapshot(payment, payment.contract, storedSnapshot.reservation),
      );
      if (
        !payment.approvalSnapshotHash ||
        storedHash !== payment.approvalSnapshotHash ||
        currentHash !== storedHash ||
        payload.snapshot_hash !== storedHash
      ) {
        return { kind: "snapshot_mismatch" as const };
      }
      if (
        input.decision === "approved" &&
        (!input.confirmation?.account_manually_checked ||
          !input.confirmation.invoice_manually_checked ||
          input.confirmation.snapshot_hash !== storedHash)
      ) {
        return { kind: "confirmation_required" as const, snapshotHash: storedHash };
      }
      const target =
        input.decision === "approved"
          ? "approved"
          : input.decision === "changes_requested"
            ? "not_started"
            : "cancelled";
      const now = new Date();
      const decisionMetadata = {
        account_manually_checked:
          input.decision === "approved" ? input.confirmation?.account_manually_checked === true : false,
        invoice_manually_checked:
          input.decision === "approved" ? input.confirmation?.invoice_manually_checked === true : false,
        snapshot_hash: storedHash,
        hash_algorithm: PAYMENT_HASH_ALGORITHM,
      };
      const checkpointUpdated = await tx.humanCheckpoint.updateMany({
        where: { id: checkpoint.id, tenantId: input.ctx.orgId, status: "pending" },
        data: {
          status: input.decision,
          decidedBy: input.ctx.userId ?? null,
          decidedAt: now,
          decisionReason: input.reason,
          decisionMetadata,
        },
      });
      if (checkpointUpdated.count !== 1) return { kind: "not_pending" as const };
      const paymentUpdated = await tx.paymentRecord.updateMany({
        where: {
          id: payment.id,
          tenantId: input.ctx.orgId,
          deletedAt: null,
          status: "pending_approval",
          approvalCheckpointId: checkpoint.id,
        },
        data: {
          status: target,
          ...(input.decision === "approved"
            ? { approvedAt: now, approvedBy: input.ctx.userId ?? null }
            : input.decision === "changes_requested"
              ? {
                  version: { increment: 1 },
                  approvalCheckpointId: null,
                  approvalSnapshot: {},
                  approvalSnapshotHash: null,
                  approvalHashAlgorithm: null,
                }
              : {}),
          updatedBy: input.ctx.userId ?? null,
        },
      });
      if (paymentUpdated.count !== 1) throw new Error("付款审批状态已变化");
      await recordStatusEvent(
        {
          tenantId: input.ctx.orgId,
          entityType: "payment_record",
          entityId: payment.id,
          fromValue: "pending_approval",
          toValue: target,
          actorId: input.ctx.userId ?? null,
          reason: input.reason ?? `付款审批${input.decision}`,
          metadata: { checkpoint_id: checkpoint.id, snapshot_hash: storedHash },
        },
        tx,
      );
      await syncCampaignPaymentStatus(tx, {
        ctx: input.ctx,
        contract: payment.contract,
        reason: "付款审批结果更新",
      });
      return { kind: "decided" as const, paymentId: payment.id };
    });
  },

  async reconcilePayment(input: {
    ctx: TenantCtx;
    paymentId: string;
    settlementRequestKey: string;
    reconciliationReference: string;
    paidAt: Date;
    evidenceNote: string;
    evidenceDocumentRef: string | null;
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.paymentRecord.findFirst({
          where: {
            tenantId: input.ctx.orgId,
            settlementRequestKey: input.settlementRequestKey,
          },
        });
        if (existing) {
          const repeated = existing.approvalSnapshotHash
            ? buildReconciliationEvidence({
                payment_id: existing.id,
                approval_snapshot_hash: existing.approvalSnapshotHash,
                reconciliation_reference: input.reconciliationReference,
                paid_at: input.paidAt.toISOString(),
                paid_by: input.ctx.userId ?? "system",
                evidence_note: input.evidenceNote,
                evidence_document_ref: input.evidenceDocumentRef,
              })
            : null;
          return existing.id === input.paymentId && repeated?.hash === existing.reconciliationHash
            ? { kind: "reconciled" as const, payment: existing, reused: true }
            : { kind: "settlement_key_reused" as const };
        }
        const initial = await tx.paymentRecord.findFirst({
          where: { id: input.paymentId, tenantId: input.ctx.orgId, deletedAt: null },
        });
        if (!initial) return { kind: "not_found" as const };
        if (!(await lockContract(tx, input.ctx.orgId, initial.contractId))) {
          return { kind: "not_found" as const };
        }
        const payment = await tx.paymentRecord.findFirst({
          where: {
            id: input.paymentId,
            tenantId: input.ctx.orgId,
            deletedAt: null,
            status: { in: ["approved", "scheduled"] },
          },
          include: { contract: true },
        });
        if (!payment) return { kind: "status_conflict" as const };
        const checkpoint = payment.approvalCheckpointId
          ? await tx.humanCheckpoint.findFirst({
              where: {
                id: payment.approvalCheckpointId,
                tenantId: input.ctx.orgId,
                type: "payment",
                entityType: "payment_record",
                entityId: payment.id,
                status: "approved",
              },
            })
          : null;
        if (!checkpoint) return { kind: "approval_required" as const };
        const snapshot = payment.approvalSnapshot as unknown as PaymentApprovalSnapshot;
        const snapshotHash = hashPaymentApprovalSnapshot(snapshot);
        const currentHash = hashPaymentApprovalSnapshot(
          paymentSnapshot(payment, payment.contract, snapshot.reservation),
        );
        if (
          !payment.approvalSnapshotHash ||
          snapshotHash !== payment.approvalSnapshotHash ||
          currentHash !== snapshotHash
        ) {
          return { kind: "snapshot_mismatch" as const };
        }
        assertTransition(PAYMENT_STATUS, payment.status, "paid");
        const reconciliation = buildReconciliationEvidence({
          payment_id: payment.id,
          approval_snapshot_hash: snapshotHash,
          reconciliation_reference: input.reconciliationReference,
          paid_at: input.paidAt.toISOString(),
          paid_by: input.ctx.userId ?? "system",
          evidence_note: input.evidenceNote,
          evidence_document_ref: input.evidenceDocumentRef,
        });
        const updated = await tx.paymentRecord.updateMany({
          where: {
            id: payment.id,
            tenantId: input.ctx.orgId,
            deletedAt: null,
            status: payment.status,
            approvalCheckpointId: checkpoint.id,
          },
          data: {
            status: "paid",
            settlementRequestKey: input.settlementRequestKey,
            reconciliationReference: input.reconciliationReference,
            reconciliationEvidence: reconciliation.evidence as unknown as Prisma.InputJsonValue,
            reconciliationHash: reconciliation.hash,
            paidAt: input.paidAt,
            paidBy: input.ctx.userId ?? null,
            updatedBy: input.ctx.userId ?? null,
          },
        });
        if (updated.count !== 1) throw new Error("付款对账状态已变化");
        await recordStatusEvent(
          {
            tenantId: input.ctx.orgId,
            entityType: "payment_record",
            entityId: payment.id,
            fromValue: payment.status,
            toValue: "paid",
            actorId: input.ctx.userId ?? null,
            reason: "登记外部付款与对账证据",
            metadata: {
              checkpoint_id: checkpoint.id,
              reconciliation_reference: input.reconciliationReference,
              reconciliation_hash: reconciliation.hash,
            },
          },
          tx,
        );
        await syncCampaignPaymentStatus(tx, {
          ctx: input.ctx,
          contract: payment.contract,
          reason: "付款对账完成",
        });
        const result = await tx.paymentRecord.findUnique({ where: { id: payment.id } });
        return { kind: "reconciled" as const, payment: result!, reused: false };
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const existing = await prisma.paymentRecord.findFirst({
          where: {
            tenantId: input.ctx.orgId,
            settlementRequestKey: input.settlementRequestKey,
          },
        });
        if (existing) {
          const repeated = existing.approvalSnapshotHash
            ? buildReconciliationEvidence({
                payment_id: existing.id,
                approval_snapshot_hash: existing.approvalSnapshotHash,
                reconciliation_reference: input.reconciliationReference,
                paid_at: input.paidAt.toISOString(),
                paid_by: input.ctx.userId ?? "system",
                evidence_note: input.evidenceNote,
                evidence_document_ref: input.evidenceDocumentRef,
              })
            : null;
          return existing.id === input.paymentId && repeated?.hash === existing.reconciliationHash
            ? { kind: "reconciled" as const, payment: existing, reused: true }
            : { kind: "settlement_key_reused" as const };
        }
        return { kind: "reconciliation_duplicate" as const };
      }
      throw error;
    }
  },

  async paidTotal(ctx: TenantCtx, contractId: string): Promise<number> {
    const agg = await prisma.paymentRecord.aggregate({
      where: { tenantId: ctx.orgId, contractId, deletedAt: null, status: "paid" },
      _sum: { amountCents: true },
    });
    return agg._sum.amountCents ?? 0;
  },
};
