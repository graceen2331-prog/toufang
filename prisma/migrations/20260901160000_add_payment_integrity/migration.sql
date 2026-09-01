ALTER TABLE "payment_records"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "request_key" TEXT,
ADD COLUMN "request_hash" TEXT,
ADD COLUMN "milestone_key" TEXT,
ADD COLUMN "milestone_label" TEXT,
ADD COLUMN "milestone_snapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "payee_name_snapshot" TEXT,
ADD COLUMN "payee_account_fingerprint" TEXT,
ADD COLUMN "payee_account_fingerprint_version" TEXT,
ADD COLUMN "payee_account_last4" TEXT,
ADD COLUMN "invoice_number" TEXT,
ADD COLUMN "invoice_issuer" TEXT,
ADD COLUMN "invoice_amount_cents" INTEGER,
ADD COLUMN "invoice_currency" TEXT,
ADD COLUMN "invoice_exception_reason" TEXT,
ADD COLUMN "invoice_fingerprint" TEXT,
ADD COLUMN "dedupe_fingerprint" TEXT,
ADD COLUMN "approval_checkpoint_id" TEXT,
ADD COLUMN "approval_snapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "approval_snapshot_hash" TEXT,
ADD COLUMN "approval_hash_algorithm" TEXT,
ADD COLUMN "settlement_request_key" TEXT,
ADD COLUMN "reconciliation_reference" TEXT,
ADD COLUMN "reconciliation_evidence" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "reconciliation_hash" TEXT,
ADD COLUMN "paid_by" TEXT;

CREATE UNIQUE INDEX "payment_records_approval_checkpoint_id_key"
ON "payment_records"("approval_checkpoint_id");
CREATE UNIQUE INDEX "payment_records_tenant_id_request_key_key"
ON "payment_records"("tenant_id", "request_key");
CREATE UNIQUE INDEX "payment_records_tenant_id_settlement_request_key_key"
ON "payment_records"("tenant_id", "settlement_request_key");
CREATE UNIQUE INDEX "payment_records_tenant_id_reconciliation_reference_key"
ON "payment_records"("tenant_id", "reconciliation_reference");
CREATE INDEX "payment_records_tenant_id_contract_id_status_idx"
ON "payment_records"("tenant_id", "contract_id", "status");

-- 相同发票或相同合同里程碑只能存在一笔有效付款；取消/失败后允许重新申请。
CREATE UNIQUE INDEX "payment_records_active_dedupe_fingerprint_key"
ON "payment_records"("tenant_id", "dedupe_fingerprint")
WHERE "deleted_at" IS NULL
  AND "dedupe_fingerprint" IS NOT NULL
  AND "status" NOT IN ('cancelled', 'failed');
