ALTER TABLE "sessions"
ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "sessions_user_id_expires_at_idx"
ON "sessions"("user_id", "expires_at");
