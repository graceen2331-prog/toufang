import "server-only";
import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const QUEUE_NAMES = {
  workflowStep: "workflow-step",
  ragIngest: "rag-ingest",
  notification: "notification",
} as const;

export interface WorkflowStepJob {
  tenantId: string;
  runId: string;
  stepKey: string;
}

export interface RagIngestJob {
  tenantId: string;
  documentId: string;
  createdBy: string | null;
}

const globalForQueues = globalThis as unknown as {
  bullConnection?: Redis;
  workflowStepQueue?: Queue<WorkflowStepJob>;
  ragIngestQueue?: Queue<RagIngestJob>;
};

function createQueue<T>(name: string): Queue<T> {
  return new Queue(name, {
    connection: getBullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    },
  }) as unknown as Queue<T>;
}

export function getBullConnection(): Redis {
  globalForQueues.bullConnection ??= new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return globalForQueues.bullConnection;
}

export function getWorkflowStepQueue(): Queue<WorkflowStepJob> {
  globalForQueues.workflowStepQueue ??= createQueue<WorkflowStepJob>(QUEUE_NAMES.workflowStep);
  return globalForQueues.workflowStepQueue;
}

export function getRagIngestQueue(): Queue<RagIngestJob> {
  globalForQueues.ragIngestQueue ??= createQueue<RagIngestJob>(QUEUE_NAMES.ragIngest);
  return globalForQueues.ragIngestQueue;
}
