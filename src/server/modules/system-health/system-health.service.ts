import "server-only";

import { systemHealthRepository } from "./system-health.repository";

const DEFAULT_PROBE_TIMEOUT_MS = 2_000;
const DEFAULT_CACHE_TTL_MS = 300;

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
  cacheTtlMs?: number;
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

export function createReadinessProbe(dependencies: ReadinessDependencies) {
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const cacheTtlMs = dependencies.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  let inFlight: Promise<ReadinessSnapshot> | null = null;
  let cached: { snapshot: ReadinessSnapshot; expiresAt: number } | null = null;

  return async (): Promise<ReadinessSnapshot> => {
    const startedAt = Date.now();
    if (cached && startedAt < cached.expiresAt) return cached.snapshot;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      const [database, redis] = await Promise.all([
        settleWithin(dependencies.checkDatabase, timeoutMs),
        settleWithin(dependencies.checkRedis, timeoutMs),
      ]);
      const snapshot: ReadinessSnapshot = {
        status: database === "ok" && redis === "ok" ? "ok" : "unavailable",
        checked_at: (dependencies.now ?? (() => new Date()))().toISOString(),
        checks: { database, redis },
      };
      cached = { snapshot, expiresAt: Date.now() + cacheTtlMs };
      return snapshot;
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}

const readinessProbe = createReadinessProbe({
  checkDatabase: () => systemHealthRepository.checkDatabase(),
  checkRedis: () => systemHealthRepository.checkRedis(),
});

export function getReadinessSnapshot(): Promise<ReadinessSnapshot> {
  return readinessProbe();
}
