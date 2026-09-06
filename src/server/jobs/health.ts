import "server-only";
import { getRagIngestQueue, getWorkflowStepQueue } from "@/server/jobs/queues";
import type { AgentInfrastructureDto } from "@/shared/schemas/agent-monitor";

const QUEUE_LABELS: Record<string, string> = {
  "workflow-step": "工作流步骤",
  "rag-ingest": "知识摄取",
};

export async function getQueueInfrastructureHealth(): Promise<AgentInfrastructureDto> {
  const checkedAt = new Date();
  try {
    const queues = [getWorkflowStepQueue(), getRagIngestQueue()];
    const snapshots = await Promise.all(
      queues.map(async (queue) => {
        const [counts, workers, oldestWaiting] = await Promise.all([
          queue.getJobCounts("waiting", "active", "delayed", "completed", "failed"),
          queue.getWorkersCount(),
          queue.getJobs(["waiting"], 0, 0, true),
        ]);
        const oldest = oldestWaiting[0];
        const waiting = counts.waiting ?? 0;
        const oldestWaitMs = oldest ? Math.max(0, checkedAt.getTime() - oldest.timestamp) : null;
        const status =
          workers === 0 && waiting > 0
            ? "offline"
            : waiting >= 20 || (oldestWaitMs !== null && oldestWaitMs >= 60_000)
              ? "degraded"
              : "healthy";
        return {
          key: queue.name,
          label: QUEUE_LABELS[queue.name] ?? queue.name,
          status,
          waiting,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          workers,
          oldest_wait_ms: oldestWaitMs,
        } as AgentInfrastructureDto["queues"][number];
      }),
    );

    return {
      status: snapshots.some((queue) => queue.status !== "healthy") ? "degraded" : "healthy",
      checked_at: checkedAt.toISOString(),
      queues: snapshots,
      message: null,
    };
  } catch (error) {
    return {
      status: "unavailable",
      checked_at: checkedAt.toISOString(),
      queues: [],
      message: error instanceof Error ? error.message : "无法读取队列健康状态",
    };
  }
}
