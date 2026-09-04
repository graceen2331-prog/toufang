-- Agent 运行补充业务关联、Prompt 快照与活动时间
ALTER TABLE "agent_runs"
ADD COLUMN "subject_type" TEXT,
ADD COLUMN "subject_id" TEXT,
ADD COLUMN "prompt_snapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "agent_runs_tenant_id_status_created_at_idx"
ON "agent_runs"("tenant_id", "status", "created_at");

CREATE INDEX "agent_runs_tenant_id_subject_type_subject_id_idx"
ON "agent_runs"("tenant_id", "subject_type", "subject_id");

-- 每一次模型 Provider 调用尝试一行，失败调用也会保留
CREATE TABLE "agent_calls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_run_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'running',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "request_payload" JSONB NOT NULL DEFAULT '{}',
    "response_payload" JSONB NOT NULL DEFAULT '{}',
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_microcents" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "error_type" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_calls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_calls_agent_run_id_phase_attempt_key"
ON "agent_calls"("agent_run_id", "phase", "attempt");

CREATE INDEX "agent_calls_tenant_id_created_at_idx"
ON "agent_calls"("tenant_id", "created_at");

CREATE INDEX "agent_calls_tenant_id_status_created_at_idx"
ON "agent_calls"("tenant_id", "status", "created_at");

CREATE INDEX "agent_calls_agent_run_id_created_at_idx"
ON "agent_calls"("agent_run_id", "created_at");

ALTER TABLE "agent_calls"
ADD CONSTRAINT "agent_calls_agent_run_id_fkey"
FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
