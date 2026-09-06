ALTER TABLE "performance_metrics"
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "attribution_window_days" INTEGER,
  ADD COLUMN "attribution_model" TEXT,
  ADD COLUMN "source_record_id" TEXT,
  ADD COLUMN "source_observed_at" TIMESTAMP(3),
  ADD COLUMN "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "metric_schema_version" INTEGER NOT NULL DEFAULT 1;

UPDATE "performance_metrics"
SET "ingested_at" = "created_at";

ALTER TABLE "performance_metrics"
  ADD CONSTRAINT "performance_metrics_attribution_window_days_check"
  CHECK ("attribution_window_days" IS NULL OR "attribution_window_days" BETWEEN 1 AND 365);

CREATE INDEX "performance_metrics_tenant_id_metric_date_idx"
  ON "performance_metrics"("tenant_id", "metric_date");
