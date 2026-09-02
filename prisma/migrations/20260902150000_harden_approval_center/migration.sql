ALTER TABLE "human_checkpoints"
  ADD COLUMN "assignee_id" TEXT,
  ADD COLUMN "due_at" TIMESTAMP(3),
  ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_escalated_at" TIMESTAMP(3),
  ADD COLUMN "last_escalated_by" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "human_checkpoints_tenant_id_status_assignee_id_due_at_idx"
  ON "human_checkpoints"("tenant_id", "status", "assignee_id", "due_at");
CREATE INDEX "human_checkpoints_tenant_id_status_due_at_idx"
  ON "human_checkpoints"("tenant_id", "status", "due_at");
CREATE INDEX "human_checkpoints_tenant_id_created_by_status_idx"
  ON "human_checkpoints"("tenant_id", "created_by", "status");

CREATE TABLE "human_checkpoint_events" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "checkpoint_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor_id" TEXT,
  "from_status" TEXT,
  "to_status" TEXT,
  "from_assignee_id" TEXT,
  "to_assignee_id" TEXT,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "human_checkpoint_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "human_checkpoint_events_tenant_id_checkpoint_id_created_at_idx"
  ON "human_checkpoint_events"("tenant_id", "checkpoint_id", "created_at");
CREATE INDEX "human_checkpoint_events_tenant_id_event_type_created_at_idx"
  ON "human_checkpoint_events"("tenant_id", "event_type", "created_at");
