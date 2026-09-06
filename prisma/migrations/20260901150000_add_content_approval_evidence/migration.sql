ALTER TABLE "content_assets"
  ADD COLUMN "active_review_id" TEXT,
  ADD COLUMN "approved_review_id" TEXT,
  ADD COLUMN "approved_checkpoint_id" TEXT,
  ADD COLUMN "approved_content_hash" TEXT,
  ADD COLUMN "content_approved_at" TIMESTAMP(3);

ALTER TABLE "content_reviews"
  ADD COLUMN "input_hash" TEXT,
  ADD COLUMN "rule_set_version" TEXT,
  ADD COLUMN "deterministic_summary" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "normalization_notes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "final_decision" TEXT,
  ADD COLUMN "checkpoint_id" TEXT,
  ADD COLUMN "override_metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "human_checkpoints"
  ADD COLUMN "decision_metadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "content_assets_tenant_id_active_review_id_idx"
  ON "content_assets"("tenant_id", "active_review_id");

CREATE UNIQUE INDEX "content_reviews_checkpoint_id_key"
  ON "content_reviews"("checkpoint_id");
