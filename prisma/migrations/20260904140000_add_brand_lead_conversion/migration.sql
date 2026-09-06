ALTER TABLE "brand_leads"
  ADD COLUMN "converted_campaign_id" TEXT,
  ADD COLUMN "converted_at" TIMESTAMP(3),
  ADD COLUMN "converted_by_id" TEXT;

CREATE UNIQUE INDEX "brand_leads_converted_campaign_id_key"
  ON "brand_leads"("converted_campaign_id");

CREATE UNIQUE INDEX "brand_leads_tenant_id_converted_campaign_id_key"
  ON "brand_leads"("tenant_id", "converted_campaign_id");

CREATE UNIQUE INDEX "campaigns_tenant_id_id_key"
  ON "campaigns"("tenant_id", "id");

ALTER TABLE "brand_leads"
  ADD CONSTRAINT "brand_leads_tenant_id_converted_campaign_id_fkey"
  FOREIGN KEY ("tenant_id", "converted_campaign_id")
  REFERENCES "campaigns"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "brand_leads"
  ADD CONSTRAINT "brand_leads_conversion_fields_check"
  CHECK (
    ("converted_campaign_id" IS NULL AND "converted_at" IS NULL AND "converted_by_id" IS NULL)
    OR
    ("converted_campaign_id" IS NOT NULL AND "converted_at" IS NOT NULL AND "converted_by_id" IS NOT NULL)
  );
