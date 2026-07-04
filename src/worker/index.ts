// BullMQ Worker 进程入口
// 启动：pnpm dev:worker（tsx 需带 --conditions=react-server 以兼容 server-only 包）
import "dotenv/config";
import { Worker } from "bullmq";
import { QUEUE_NAMES, getBullConnection, type WorkflowStepJob } from "@/server/jobs/queues";
import { executeStep, onStepFailed } from "@/server/workflows/engine";

async function main() {
  const workflowWorker = new Worker<WorkflowStepJob>(
    QUEUE_NAMES.workflowStep,
    async (job) => {
      const { tenantId, runId, stepKey } = job.data;
      console.log(`[worker] 执行步骤 run=${runId} step=${stepKey} attempt=${job.attemptsMade + 1}`);
      await executeStep(tenantId, runId, stepKey);
    },
    { connection: getBullConnection(), concurrency: 5, prefix: process.env.QUEUE_PREFIX ?? "bull" },
  );

  workflowWorker.on("failed", (job, err) => {
    console.error(`[worker] 步骤失败 ${job?.id}:`, err.message);
    // 最后一次尝试失败 → 落库标记 run 失败
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const { tenantId, runId, stepKey } = job.data;
      void onStepFailed(tenantId, runId, stepKey, err.message);
    }
  });

  workflowWorker.on("ready", () => {
    console.log("[worker] workflow-step 队列消费者就绪（concurrency=5）");
  });

  const shutdown = async () => {
    console.log("[worker] 收到退出信号，正在关闭…");
    await workflowWorker.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[worker] 启动失败", err);
  process.exit(1);
});
