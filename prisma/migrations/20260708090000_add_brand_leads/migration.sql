CREATE TABLE "brand_leads" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ces_2026',
  "source_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "country" TEXT,
  "description" TEXT,
  "product_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "booth_venue" TEXT,
  "booth_number" TEXT,
  "booth_full" TEXT,
  "seek_funding" TEXT,
  "funding_amount" TEXT,
  "revenue" TEXT,
  "investment_stage" TEXT,
  "opportunity_score" INTEGER NOT NULL DEFAULT 0,
  "opportunity_tier" TEXT NOT NULL DEFAULT 'watch',
  "recommended_creator_profile" TEXT,
  "campaign_angles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "outreach_signals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "raw_data" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "updated_by" TEXT,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,

  CONSTRAINT "brand_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_leads_tenant_id_source_source_id_key"
  ON "brand_leads"("tenant_id", "source", "source_id");
CREATE INDEX "brand_leads_tenant_id_idx" ON "brand_leads"("tenant_id");
CREATE INDEX "brand_leads_tenant_id_source_idx" ON "brand_leads"("tenant_id", "source");
CREATE INDEX "brand_leads_tenant_id_country_idx" ON "brand_leads"("tenant_id", "country");
CREATE INDEX "brand_leads_tenant_id_opportunity_tier_idx" ON "brand_leads"("tenant_id", "opportunity_tier");
CREATE INDEX "brand_leads_tenant_id_opportunity_score_idx" ON "brand_leads"("tenant_id", "opportunity_score");
