-- 每条 reports 记录代表一个独立版本；旧数据各自成为版本链根节点。
ALTER TABLE "reports"
ADD COLUMN "series_id" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "supersedes_id" TEXT,
ADD COLUMN "lock_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "submitted_snapshot_hash" TEXT,
ADD COLUMN "approved_snapshot_hash" TEXT,
ADD COLUMN "hash_algorithm" TEXT,
ADD COLUMN "derivation_reason" TEXT;

UPDATE "reports" SET "series_id" = "id" WHERE "series_id" IS NULL;
ALTER TABLE "reports" ALTER COLUMN "series_id" SET NOT NULL;

CREATE UNIQUE INDEX "reports_supersedes_id_key" ON "reports"("supersedes_id");
CREATE UNIQUE INDEX "reports_tenant_id_series_id_version_key"
ON "reports"("tenant_id", "series_id", "version");

ALTER TABLE "reports"
ADD CONSTRAINT "reports_supersedes_id_fkey"
FOREIGN KEY ("supersedes_id") REFERENCES "reports"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 每次导出保存一份追加式 JSON 快照；同一幂等键只能生成一次。
CREATE TABLE "report_exports" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "report_version" INTEGER NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'json_snapshot',
  "recipient" TEXT NOT NULL,
  "purpose" TEXT,
  "snapshot" JSONB NOT NULL,
  "snapshot_hash" TEXT NOT NULL,
  "hash_algorithm" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_exports_tenant_id_idempotency_key_key"
ON "report_exports"("tenant_id", "idempotency_key");
CREATE INDEX "report_exports_tenant_id_report_id_created_at_idx"
ON "report_exports"("tenant_id", "report_id", "created_at");

ALTER TABLE "report_exports"
ADD CONSTRAINT "report_exports_report_id_fkey"
FOREIGN KEY ("report_id") REFERENCES "reports"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 正式版本的受保护字段不能再被后续代码路径原地改写。
CREATE FUNCTION protect_formal_report_version() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('approved', 'exported') AND (
    NEW."campaign_id" IS DISTINCT FROM OLD."campaign_id" OR
    NEW."title" IS DISTINCT FROM OLD."title" OR
    NEW."kind" IS DISTINCT FROM OLD."kind" OR
    NEW."content" IS DISTINCT FROM OLD."content" OR
    NEW."ai_generated" IS DISTINCT FROM OLD."ai_generated" OR
    NEW."agent_run_id" IS DISTINCT FROM OLD."agent_run_id" OR
    NEW."prompt_key" IS DISTINCT FROM OLD."prompt_key" OR
    NEW."prompt_version" IS DISTINCT FROM OLD."prompt_version" OR
    NEW."model" IS DISTINCT FROM OLD."model" OR
    NEW."series_id" IS DISTINCT FROM OLD."series_id" OR
    NEW."version" IS DISTINCT FROM OLD."version" OR
    NEW."supersedes_id" IS DISTINCT FROM OLD."supersedes_id" OR
    NEW."lock_version" IS DISTINCT FROM OLD."lock_version" OR
    NEW."submitted_snapshot_hash" IS DISTINCT FROM OLD."submitted_snapshot_hash" OR
    NEW."approved_at" IS DISTINCT FROM OLD."approved_at" OR
    NEW."approved_by" IS DISTINCT FROM OLD."approved_by" OR
    (OLD."approved_snapshot_hash" IS NOT NULL AND
      NEW."approved_snapshot_hash" IS DISTINCT FROM OLD."approved_snapshot_hash") OR
    (OLD."hash_algorithm" IS NOT NULL AND
      NEW."hash_algorithm" IS DISTINCT FROM OLD."hash_algorithm") OR
    NEW."derivation_reason" IS DISTINCT FROM OLD."derivation_reason" OR
    NEW."deleted_at" IS DISTINCT FROM OLD."deleted_at"
  ) THEN
    RAISE EXCEPTION '正式报告版本不可修改';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reports_formal_version_immutable"
BEFORE UPDATE ON "reports"
FOR EACH ROW EXECUTE FUNCTION protect_formal_report_version();

CREATE FUNCTION protect_report_export_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '报告导出记录仅允许追加';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "report_exports_append_only"
BEFORE UPDATE OR DELETE ON "report_exports"
FOR EACH ROW EXECUTE FUNCTION protect_report_export_append_only();
