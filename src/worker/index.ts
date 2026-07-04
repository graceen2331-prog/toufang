// BullMQ Worker 进程入口
// 启动：pnpm dev:worker
// W4 起在此注册队列消费者（workflow-step / rag-ingest / metrics-snapshot / notification）
import "dotenv/config";

async function main() {
  console.log("[worker] KOL Marketing OS worker 启动（暂无注册队列，W4 接入工作流引擎）");
  // 保持进程存活
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[worker] 启动失败", err);
  process.exit(1);
});
