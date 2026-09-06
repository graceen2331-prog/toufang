-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ai_monthly_budget_cents" INTEGER NOT NULL DEFAULT 100000,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "avatar_url" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "brand_scope" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "active_org_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "markets" JSONB NOT NULL DEFAULT '[]',
    "guidelines" JSONB NOT NULL DEFAULT '{}',
    "restricted_terms" JSONB NOT NULL DEFAULT '[]',
    "logo_file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" JSONB NOT NULL DEFAULT '{}',
    "key_claims" JSONB NOT NULL DEFAULT '[]',
    "restricted_claims" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creators" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "profile_summary" TEXT,
    "relationship_status" TEXT NOT NULL DEFAULT 'new',
    "risk_level" TEXT NOT NULL DEFAULT 'unknown',
    "country" TEXT,
    "languages" JSONB NOT NULL DEFAULT '[]',
    "categories" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contact_info" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "agent_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_platform_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "url" TEXT,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_views" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "creator_platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_metric_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "platform" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_content_samples" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "platform" TEXT,
    "url" TEXT,
    "title" TEXT,
    "content_type" TEXT,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "analysis" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "creator_content_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_scores" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "tier" TEXT,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "risk" JSONB NOT NULL DEFAULT '{}',
    "explanation" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "creator_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "creator_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "health_status" TEXT NOT NULL DEFAULT 'on_track',
    "markets" JSONB NOT NULL DEFAULT '[]',
    "platforms" JSONB NOT NULL DEFAULT '[]',
    "budget_total_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "goals" JSONB NOT NULL DEFAULT '{}',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_creators" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "contract_status" TEXT NOT NULL DEFAULT 'none',
    "payment_status" TEXT NOT NULL DEFAULT 'none',
    "content_status" TEXT NOT NULL DEFAULT 'none',
    "role" TEXT,
    "quoted_price_cents" INTEGER,
    "agreed_price_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "agent_run_id" TEXT,
    "match_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "campaign_creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_strategy_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "summary" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "campaign_strategy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_tasks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignee_id" TEXT,
    "due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "campaign_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_budget_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planned_cents" INTEGER NOT NULL DEFAULT 0,
    "reserved_cents" INTEGER NOT NULL DEFAULT 0,
    "spent_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "related_type" TEXT,
    "related_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "campaign_budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT 'status',
    "from_value" TEXT,
    "to_value" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL DEFAULT 'user',
    "actor_id" TEXT,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_threads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_creator_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "status" TEXT NOT NULL DEFAULT 'open',
    "subject" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "outreach_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sequence_id" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approval_status" TEXT NOT NULL DEFAULT 'not_required',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "reply_intent" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "outreach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_sequences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "outreach_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'analyzing',
    "quoted_price_cents" INTEGER,
    "counter_price_cents" INTEGER,
    "agreed_price_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "pricing_analysis" JSONB NOT NULL DEFAULT '{}',
    "strategy" JSONB NOT NULL DEFAULT '{}',
    "agreed_terms" JSONB NOT NULL DEFAULT '{}',
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "negotiation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_version_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brief_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "plain_text" TEXT NOT NULL,
    "change_summary" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "brief_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_creator_id" TEXT NOT NULL,
    "brief_id" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "content_type" TEXT,
    "platform" TEXT,
    "caption" TEXT,
    "transcript" TEXT,
    "url" TEXT,
    "file_id" TEXT,
    "planned_publish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "published_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_asset_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "decision" TEXT,
    "risk_level" TEXT,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "feedback" TEXT,
    "reviewer_id" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_creator_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "amount_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "usage_rights" JSONB NOT NULL DEFAULT '{}',
    "exclusivity_terms" JSONB NOT NULL DEFAULT '{}',
    "payment_terms" JSONB NOT NULL DEFAULT '{}',
    "file_id" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "method" TEXT,
    "account_info" JSONB NOT NULL DEFAULT '{}',
    "invoice" JSONB NOT NULL DEFAULT '{}',
    "paid_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "platform" TEXT,
    "metric_date" DATE NOT NULL,
    "metrics" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'campaign_retro',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL DEFAULT '{}',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "agent_run_id" TEXT,
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "subject_type" TEXT,
    "subject_id" TEXT,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_key" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_run_id" TEXT,
    "agent_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "tool_calls" JSONB NOT NULL DEFAULT '[]',
    "prompt_key" TEXT,
    "prompt_version" TEXT,
    "model" TEXT,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_checkpoints" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_run_id" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignee_role" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "human_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_run_id" TEXT,
    "agent_key" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'chat',
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_microcents" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'document',
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "visibility" TEXT NOT NULL DEFAULT 'workspace',
    "source_type" TEXT,
    "source_id" TEXT,
    "brand_id" TEXT,
    "campaign_id" TEXT,
    "file_id" TEXT,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "agent_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "heading_path" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_queries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "agent_run_id" TEXT,
    "query" TEXT NOT NULL,
    "answer" TEXT,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "feedback" TEXT,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "object_key" TEXT NOT NULL,
    "checksum" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "request_id" TEXT,
    "actor_type" TEXT NOT NULL DEFAULT 'user',
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link_url" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_connected',
    "config" JSONB NOT NULL DEFAULT '{}',
    "secrets" JSONB NOT NULL DEFAULT '{}',
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "workspaces_tenant_id_idx" ON "workspaces"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_tenant_id_slug_key" ON "workspaces"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_key_key" ON "roles"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_tenant_id_idx" ON "api_tokens"("tenant_id");

-- CreateIndex
CREATE INDEX "brands_tenant_id_idx" ON "brands"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_tenant_id_slug_key" ON "brands"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "products_tenant_id_idx" ON "products"("tenant_id");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "creators_tenant_id_idx" ON "creators"("tenant_id");

-- CreateIndex
CREATE INDEX "creators_tenant_id_relationship_status_idx" ON "creators"("tenant_id", "relationship_status");

-- CreateIndex
CREATE INDEX "creator_platform_accounts_tenant_id_idx" ON "creator_platform_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "creator_platform_accounts_creator_id_idx" ON "creator_platform_accounts"("creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_platform_accounts_tenant_id_platform_handle_key" ON "creator_platform_accounts"("tenant_id", "platform", "handle");

-- CreateIndex
CREATE INDEX "creator_metric_snapshots_tenant_id_idx" ON "creator_metric_snapshots"("tenant_id");

-- CreateIndex
CREATE INDEX "creator_metric_snapshots_creator_id_captured_at_idx" ON "creator_metric_snapshots"("creator_id", "captured_at");

-- CreateIndex
CREATE INDEX "creator_content_samples_tenant_id_idx" ON "creator_content_samples"("tenant_id");

-- CreateIndex
CREATE INDEX "creator_content_samples_creator_id_idx" ON "creator_content_samples"("creator_id");

-- CreateIndex
CREATE INDEX "creator_scores_tenant_id_idx" ON "creator_scores"("tenant_id");

-- CreateIndex
CREATE INDEX "creator_scores_creator_id_idx" ON "creator_scores"("creator_id");

-- CreateIndex
CREATE INDEX "creator_scores_campaign_id_idx" ON "creator_scores"("campaign_id");

-- CreateIndex
CREATE INDEX "creator_notes_tenant_id_idx" ON "creator_notes"("tenant_id");

-- CreateIndex
CREATE INDEX "creator_notes_creator_id_idx" ON "creator_notes"("creator_id");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_idx" ON "campaigns"("tenant_id");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_status_idx" ON "campaigns"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_brand_id_idx" ON "campaigns"("brand_id");

-- CreateIndex
CREATE INDEX "campaign_creators_tenant_id_idx" ON "campaign_creators"("tenant_id");

-- CreateIndex
CREATE INDEX "campaign_creators_campaign_id_status_idx" ON "campaign_creators"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "campaign_creators_creator_id_idx" ON "campaign_creators"("creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_creators_tenant_id_campaign_id_creator_id_key" ON "campaign_creators"("tenant_id", "campaign_id", "creator_id");

-- CreateIndex
CREATE INDEX "campaign_strategy_versions_tenant_id_idx" ON "campaign_strategy_versions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_strategy_versions_tenant_id_campaign_id_version_key" ON "campaign_strategy_versions"("tenant_id", "campaign_id", "version");

-- CreateIndex
CREATE INDEX "campaign_tasks_tenant_id_idx" ON "campaign_tasks"("tenant_id");

-- CreateIndex
CREATE INDEX "campaign_tasks_campaign_id_status_idx" ON "campaign_tasks"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "campaign_budget_items_tenant_id_idx" ON "campaign_budget_items"("tenant_id");

-- CreateIndex
CREATE INDEX "campaign_budget_items_campaign_id_idx" ON "campaign_budget_items"("campaign_id");

-- CreateIndex
CREATE INDEX "status_events_tenant_id_idx" ON "status_events"("tenant_id");

-- CreateIndex
CREATE INDEX "status_events_entity_type_entity_id_created_at_idx" ON "status_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "outreach_threads_tenant_id_idx" ON "outreach_threads"("tenant_id");

-- CreateIndex
CREATE INDEX "outreach_threads_campaign_creator_id_idx" ON "outreach_threads"("campaign_creator_id");

-- CreateIndex
CREATE INDEX "outreach_messages_tenant_id_idx" ON "outreach_messages"("tenant_id");

-- CreateIndex
CREATE INDEX "outreach_messages_thread_id_idx" ON "outreach_messages"("thread_id");

-- CreateIndex
CREATE INDEX "outreach_messages_tenant_id_status_idx" ON "outreach_messages"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "outreach_sequences_tenant_id_idx" ON "outreach_sequences"("tenant_id");

-- CreateIndex
CREATE INDEX "negotiation_records_tenant_id_idx" ON "negotiation_records"("tenant_id");

-- CreateIndex
CREATE INDEX "negotiation_records_thread_id_idx" ON "negotiation_records"("thread_id");

-- CreateIndex
CREATE INDEX "briefs_tenant_id_idx" ON "briefs"("tenant_id");

-- CreateIndex
CREATE INDEX "briefs_campaign_id_idx" ON "briefs"("campaign_id");

-- CreateIndex
CREATE INDEX "brief_versions_tenant_id_idx" ON "brief_versions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "brief_versions_tenant_id_brief_id_version_key" ON "brief_versions"("tenant_id", "brief_id", "version");

-- CreateIndex
CREATE INDEX "content_assets_tenant_id_idx" ON "content_assets"("tenant_id");

-- CreateIndex
CREATE INDEX "content_assets_campaign_creator_id_idx" ON "content_assets"("campaign_creator_id");

-- CreateIndex
CREATE INDEX "content_assets_tenant_id_status_idx" ON "content_assets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "content_reviews_tenant_id_idx" ON "content_reviews"("tenant_id");

-- CreateIndex
CREATE INDEX "content_reviews_content_asset_id_idx" ON "content_reviews"("content_asset_id");

-- CreateIndex
CREATE INDEX "contracts_tenant_id_idx" ON "contracts"("tenant_id");

-- CreateIndex
CREATE INDEX "contracts_campaign_creator_id_idx" ON "contracts"("campaign_creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_tenant_id_contract_number_key" ON "contracts"("tenant_id", "contract_number");

-- CreateIndex
CREATE INDEX "payment_records_tenant_id_idx" ON "payment_records"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_records_contract_id_idx" ON "payment_records"("contract_id");

-- CreateIndex
CREATE INDEX "performance_metrics_tenant_id_idx" ON "performance_metrics"("tenant_id");

-- CreateIndex
CREATE INDEX "performance_metrics_entity_type_entity_id_metric_date_idx" ON "performance_metrics"("entity_type", "entity_id", "metric_date");

-- CreateIndex
CREATE UNIQUE INDEX "performance_metrics_tenant_id_entity_type_entity_id_platfor_key" ON "performance_metrics"("tenant_id", "entity_type", "entity_id", "platform", "metric_date");

-- CreateIndex
CREATE INDEX "insights_tenant_id_idx" ON "insights"("tenant_id");

-- CreateIndex
CREATE INDEX "insights_campaign_id_idx" ON "insights"("campaign_id");

-- CreateIndex
CREATE INDEX "reports_tenant_id_idx" ON "reports"("tenant_id");

-- CreateIndex
CREATE INDEX "reports_campaign_id_idx" ON "reports"("campaign_id");

-- CreateIndex
CREATE INDEX "workflow_runs_tenant_id_idx" ON "workflow_runs"("tenant_id");

-- CreateIndex
CREATE INDEX "workflow_runs_tenant_id_status_idx" ON "workflow_runs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "workflow_runs_subject_type_subject_id_idx" ON "workflow_runs"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "workflow_steps_tenant_id_idx" ON "workflow_steps"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_run_id_step_key_key" ON "workflow_steps"("run_id", "step_key");

-- CreateIndex
CREATE INDEX "agent_runs_tenant_id_idx" ON "agent_runs"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_runs_workflow_run_id_idx" ON "agent_runs"("workflow_run_id");

-- CreateIndex
CREATE INDEX "agent_runs_tenant_id_agent_key_created_at_idx" ON "agent_runs"("tenant_id", "agent_key", "created_at");

-- CreateIndex
CREATE INDEX "human_checkpoints_tenant_id_idx" ON "human_checkpoints"("tenant_id");

-- CreateIndex
CREATE INDEX "human_checkpoints_tenant_id_status_idx" ON "human_checkpoints"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "human_checkpoints_entity_type_entity_id_idx" ON "human_checkpoints"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ai_usage_events_tenant_id_created_at_idx" ON "ai_usage_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_events_agent_run_id_idx" ON "ai_usage_events"("agent_run_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_tenant_id_idx" ON "knowledge_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_tenant_id_status_idx" ON "knowledge_documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_chunks_tenant_id_idx" ON "knowledge_chunks"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_document_id_chunk_index_key" ON "knowledge_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE INDEX "rag_queries_tenant_id_created_at_idx" ON "rag_queries"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "files_tenant_id_idx" ON "files"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_provider_object_key_key" ON "files"("provider", "object_key");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_created_at_idx" ON "notifications"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "integration_connections_tenant_id_idx" ON "integration_connections"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_tenant_id_provider_key" ON "integration_connections"("tenant_id", "provider");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_platform_accounts" ADD CONSTRAINT "creator_platform_accounts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_metric_snapshots" ADD CONSTRAINT "creator_metric_snapshots_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_content_samples" ADD CONSTRAINT "creator_content_samples_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_scores" ADD CONSTRAINT "creator_scores_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_notes" ADD CONSTRAINT "creator_notes_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_creators" ADD CONSTRAINT "campaign_creators_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_creators" ADD CONSTRAINT "campaign_creators_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_strategy_versions" ADD CONSTRAINT "campaign_strategy_versions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_tasks" ADD CONSTRAINT "campaign_tasks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_budget_items" ADD CONSTRAINT "campaign_budget_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "outreach_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_records" ADD CONSTRAINT "negotiation_records_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "outreach_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_versions" ADD CONSTRAINT "brief_versions_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "briefs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_content_asset_id_fkey" FOREIGN KEY ("content_asset_id") REFERENCES "content_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "workflow_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_checkpoints" ADD CONSTRAINT "human_checkpoints_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
