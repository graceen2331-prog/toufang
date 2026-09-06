-- 手动重试必须创建新运行；旧运行保持终态，并通过一对一关系保留审计链。
ALTER TABLE "workflow_runs"
ADD COLUMN "retry_of_run_id" TEXT;

CREATE UNIQUE INDEX "workflow_runs_retry_of_run_id_key"
ON "workflow_runs"("retry_of_run_id");

ALTER TABLE "workflow_runs"
ADD CONSTRAINT "workflow_runs_retry_of_run_id_fkey"
FOREIGN KEY ("retry_of_run_id") REFERENCES "workflow_runs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
