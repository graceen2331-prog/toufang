import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Redis from "ioredis";

const DEPENDENCY_TIMEOUT_MS = 1_250;

const globalForHealth = globalThis as unknown as {
  healthPrisma?: PrismaClient;
  healthRedis?: Redis;
};

function getHealthPrisma(): PrismaClient {
  globalForHealth.healthPrisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      max: 1,
      connectionTimeoutMillis: DEPENDENCY_TIMEOUT_MS,
      query_timeout: DEPENDENCY_TIMEOUT_MS,
      statement_timeout: DEPENDENCY_TIMEOUT_MS,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    }),
  });
  return globalForHealth.healthPrisma;
}

function getHealthRedis(): Redis {
  if (globalForHealth.healthRedis) return globalForHealth.healthRedis;

  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    connectTimeout: DEPENDENCY_TIMEOUT_MS,
    commandTimeout: DEPENDENCY_TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });
  // 连接错误由 readiness 状态承载；避免 EventEmitter 将其升级为未处理错误。
  client.on("error", () => undefined);
  globalForHealth.healthRedis = client;
  return client;
}

export const systemHealthRepository = {
  async checkDatabase(): Promise<void> {
    await getHealthPrisma().$queryRaw`SELECT 1`;
  },

  async checkRedis(): Promise<void> {
    const client = getHealthRedis();
    if (client.status === "wait") await client.connect();
    if (client.status !== "ready") throw new Error("Redis 尚未就绪");
    await client.ping();
  },
};
