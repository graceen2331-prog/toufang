import "server-only";
import { createHash, createHmac } from "node:crypto";

export const PAYMENT_HASH_ALGORITHM = "sha256-canonical-json-v1";
export const PAYMENT_FINGERPRINT_VERSION = "hmac-sha256-v1";

export interface PaymentPayeeInput {
  name: string;
  bank_name: string;
  account_number: string;
}

export interface PaymentInvoiceInput {
  number?: string | null;
  issuer?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  exception_reason?: string | null;
}

export interface NormalizedPaymentEvidence {
  payee: {
    name: string;
    bank_name: string;
    account_number: string;
    account_last4: string;
    account_fingerprint: string;
    fingerprint_version: string;
  };
  invoice: {
    number: string | null;
    issuer: string | null;
    amount_cents: number | null;
    currency: string | null;
    exception_reason: string | null;
    fingerprint: string | null;
  };
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function normalizeAccountNumber(value: string): string {
  return value.normalize("NFKC").replace(/[\s-]+/g, "").toUpperCase();
}

function fingerprintSecret(): string {
  const dedicated = process.env.PAYMENT_FINGERPRINT_KEY;
  if (dedicated) return dedicated;
  if (process.env.NODE_ENV !== "production" && process.env.DATA_ENCRYPTION_KEY) {
    return `payment-fingerprint:${process.env.DATA_ENCRYPTION_KEY}`;
  }
  throw new Error("缺少 PAYMENT_FINGERPRINT_KEY 环境变量");
}

function hmac(value: string): string {
  return createHmac("sha256", fingerprintSecret()).update(value, "utf8").digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("付款快照包含非有限数字");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  throw new Error(`付款快照包含不支持的值：${typeof value}`);
}

export function hashPaymentValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

export function normalizePaymentEvidence(
  payeeInput: PaymentPayeeInput,
  invoiceInput: PaymentInvoiceInput,
): NormalizedPaymentEvidence {
  const name = normalizeText(payeeInput.name);
  const bankName = normalizeText(payeeInput.bank_name);
  const accountNumber = normalizeAccountNumber(payeeInput.account_number);
  const number = invoiceInput.number ? normalizeText(invoiceInput.number) : null;
  const issuer = invoiceInput.issuer ? normalizeText(invoiceInput.issuer) : null;
  const exceptionReason = invoiceInput.exception_reason
    ? normalizeText(invoiceInput.exception_reason)
    : null;
  const accountFingerprint = hmac(
    `account|${PAYMENT_FINGERPRINT_VERSION}|${bankName.toLowerCase()}|${accountNumber}`,
  );
  const invoiceFingerprint =
    number && issuer
      ? hmac(
          `invoice|${PAYMENT_FINGERPRINT_VERSION}|${issuer.toLowerCase()}|${number.toLowerCase()}|${accountFingerprint}`,
        )
      : null;

  return {
    payee: {
      name,
      bank_name: bankName,
      account_number: accountNumber,
      account_last4: accountNumber.slice(-4),
      account_fingerprint: accountFingerprint,
      fingerprint_version: PAYMENT_FINGERPRINT_VERSION,
    },
    invoice: {
      number,
      issuer,
      amount_cents: invoiceInput.amount_cents ?? null,
      currency: invoiceInput.currency ? normalizeText(invoiceInput.currency).toUpperCase() : null,
      exception_reason: exceptionReason,
      fingerprint: invoiceFingerprint,
    },
  };
}

export function buildPaymentRequestIntegrity(input: {
  contract_id: string;
  request_key: string;
  amount_cents: number;
  currency: string;
  method: string;
  milestone_key: string;
  milestone_label: string;
  evidence: NormalizedPaymentEvidence;
}): { requestHash: string; dedupeFingerprint: string } {
  const safeRequest = {
    contract_id: input.contract_id,
    request_key: input.request_key,
    amount_cents: input.amount_cents,
    currency: input.currency,
    method: input.method,
    milestone_key: normalizeText(input.milestone_key),
    milestone_label: normalizeText(input.milestone_label),
    payee_name: input.evidence.payee.name,
    payee_account_fingerprint: input.evidence.payee.account_fingerprint,
    invoice: input.evidence.invoice,
  };
  const dedupeMaterial = input.evidence.invoice.fingerprint
    ? `invoice|${input.evidence.invoice.fingerprint}`
    : [
        "payment",
        input.contract_id,
        normalizeText(input.milestone_key),
        input.amount_cents,
        input.currency,
        input.evidence.payee.account_fingerprint,
      ].join("|");
  return {
    requestHash: hashPaymentValue(safeRequest),
    dedupeFingerprint: hmac(dedupeMaterial),
  };
}

export interface PaymentApprovalSnapshot {
  payment_id: string;
  payment_version: number;
  requester_id: string | null;
  amount_cents: number;
  currency: string;
  method: string | null;
  contract: {
    id: string;
    number: string;
    version: number;
    status: string;
    amount_cents: number;
    payment_terms: unknown;
  };
  milestone: { key: string | null; label: string | null; snapshot: unknown };
  payee: {
    name: string | null;
    bank_name: string | null;
    account_last4: string | null;
    account_fingerprint: string | null;
    fingerprint_version: string | null;
  };
  invoice: {
    number: string | null;
    issuer: string | null;
    amount_cents: number | null;
    currency: string | null;
    exception_reason: string | null;
    fingerprint: string | null;
  };
  reservation: { committed_cents: number; remaining_cents: number };
}

export function buildPaymentApprovalSnapshot(input: PaymentApprovalSnapshot): PaymentApprovalSnapshot {
  return input;
}

export function hashPaymentApprovalSnapshot(snapshot: PaymentApprovalSnapshot): string {
  return hashPaymentValue(snapshot);
}

export function buildReconciliationEvidence(input: {
  payment_id: string;
  approval_snapshot_hash: string;
  reconciliation_reference: string;
  paid_at: string;
  paid_by: string;
  evidence_note: string;
  evidence_document_ref: string | null;
}) {
  const evidence = {
    payment_id: input.payment_id,
    approval_snapshot_hash: input.approval_snapshot_hash,
    reconciliation_reference: normalizeText(input.reconciliation_reference),
    paid_at: input.paid_at,
    paid_by: input.paid_by,
    evidence_note: normalizeText(input.evidence_note),
    evidence_document_ref: input.evidence_document_ref
      ? normalizeText(input.evidence_document_ref)
      : null,
  };
  return { evidence, hash: hashPaymentValue(evidence) };
}
