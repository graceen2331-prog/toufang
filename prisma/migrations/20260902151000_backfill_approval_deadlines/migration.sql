UPDATE "human_checkpoints"
SET "due_at" = "created_at" + CASE "priority"
  WHEN 'urgent' THEN INTERVAL '4 hours'
  WHEN 'high' THEN INTERVAL '24 hours'
  WHEN 'low' THEN INTERVAL '120 hours'
  ELSE INTERVAL '48 hours'
END
WHERE "due_at" IS NULL;
