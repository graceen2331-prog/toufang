import "server-only";

import { systemHealthRepository } from "./system-health.repository";

const DEFAULT_PROBE_TIMEOUT_MS = 2_000;

export type DependencyStatus = "ok" | "unavailable";

export interface ReadinessSnapshot {
  status: "ok" | "unavailable";
  checked_at: string;
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

interface ReadinessDependencies {
  checkDatabase: () => Promise<void>;
  checkRedis: () => Promise<void>;
  now?: () => Date;
  timeoutMs?: number;
}

async function settleWithin(check: () => Promise<void>, timeoutMs: number): Promise<DependencyStatus> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("健康检查超时")), timeoutMs);
      }),
    ]);
    return "ok";
  } catch {
    return "unavailable";
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function getLivenessSnapshot(now: () => Date = () => new Date()) {
  return {
    status: "ok" as const,
    checked_at: now().toISOString(),
  };
}

export async function getReadinessSnapshot(
  dependencies: ReadinessDependencies = {
    checkDatabase: () => systemHealthRepository.checkDatabase(),
    checkRedis: () => systemHealthRepository.checkRedis(),
  },
): Promise<ReadinessSnapshot> {
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const [database, redis] = await Promise.all([
    settleWithin(dependencies.checkDatabase, timeoutMs),
    settleWithin(dependencies.checkRedis, timeoutMs),
  ]);

  return {
    status: database === "ok" && redis === "ok" ? "ok" : "unavailable",
    checked_at: (dependencies.now ?? (() => new Date()))().toISOString(),
    checks: { database, redis },
  };
}
