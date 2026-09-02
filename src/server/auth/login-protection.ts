import "server-only";
import { createHmac } from "node:crypto";
import Redis from "ioredis";
import { ApiError } from "@/server/api/envelope";

const TOTAL_IP_LIMIT = 60;
const TOTAL_IP_WINDOW_MS = 5 * 60 * 1000;
const FAILED_IP_LIMIT = 30;
const FAILED_PAIR_LIMIT = 5;
const FAILED_WINDOW_MS = 15 * 60 * 1000;

interface WindowEntry {
  count: number;
  expiresAt: number;
}

const globalState = globalThis as unknown as {
  loginRateLimitRedis?: Redis;
  loginRateLimitMemory?: Map<string, WindowEntry>;
};

function backend(env: NodeJS.ProcessEnv = process.env): "redis" | "memory" | "disabled" {
  const configured = env.AUTH_RATE_LIMIT_BACKEND;
  if (configured === "redis" || configured === "memory" || configured === "disabled") {
    if (env.NODE_ENV === "production" && configured !== "redis") return "redis";
    return configured;
  }
  return env.NODE_ENV === "production" ? "redis" : "memory";
}

function secret(env: NodeJS.ProcessEnv = process.env): string {
  if (env.AUTH_RATE_LIMIT_HMAC_KEY) return env.AUTH_RATE_LIMIT_HMAC_KEY;
  if (env.NODE_ENV !== "production") return "local-login-rate-limit-key-not-for-production";
  throw unavailable();
}

function digest(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return createHmac("sha256", secret(env)).update(value).digest("hex").slice(0, 32);
}

function keys(input: { email: string; clientIp: string | null }) {
  const email = input.email.normalize("NFKC").trim().toLowerCase();
  const ipDigest = input.clientIp ? digest(`ip|${input.clientIp}`) : null;
  return {
    totalIp: ipDigest ? `auth:login:total-ip:${ipDigest}` : null,
    failedIp: ipDigest ? `auth:login:failed-ip:${ipDigest}` : null,
    failedPair: `auth:login:failed-pair:${digest(`pair|${input.clientIp ?? "local"}|${email}`)}`,
  };
}

function memoryStore(): Map<string, WindowEntry> {
  globalState.loginRateLimitMemory ??= new Map();
  return globalState.loginRateLimitMemory;
}

function memoryIncrement(key: string, windowMs: number, now = Date.now()): WindowEntry {
  const store = memoryStore();
  const current = store.get(key);
  const next = !current || current.expiresAt <= now
    ? { count: 1, expiresAt: now + windowMs }
    : { ...current, count: current.count + 1 };
  store.set(key, next);
  return next;
}

function memoryGet(key: string, now = Date.now()): WindowEntry | null {
  const store = memoryStore();
  const current = store.get(key);
  if (!current || current.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  return current;
}

function redisClient(): Redis {
  if (!globalState.loginRateLimitRedis) {
    const redis = new Redis(process.env.REDIS_URL!, {
      connectTimeout: 2_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.on("error", () => undefined);
    globalState.loginRateLimitRedis = redis;
  }
  return globalState.loginRateLimitRedis;
}

async function ensureRedisConnected(redis: Redis): Promise<void> {
  if (redis.status === "wait") await redis.connect();
  if (redis.status !== "ready") throw new Error(`Redis 状态异常：${redis.status}`);
}

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('PTTL', KEYS[1])}
`;

async function redisIncrement(key: string, windowMs: number): Promise<WindowEntry> {
  const redis = redisClient();
  await ensureRedisConnected(redis);
  const result = (await redis.eval(INCREMENT_SCRIPT, 1, key, windowMs)) as [number, number];
  return { count: Number(result[0]), expiresAt: Date.now() + Math.max(0, Number(result[1])) };
}

async function redisGet(key: string): Promise<WindowEntry | null> {
  const redis = redisClient();
  await ensureRedisConnected(redis);
  const [rawCount, rawTtl] = await redis.multi().get(key).pttl(key).exec().then((items) => [
    items?.[0]?.[1],
    items?.[1]?.[1],
  ]);
  const count = Number(rawCount ?? 0);
  const ttl = Number(rawTtl ?? -1);
  return count > 0 && ttl > 0 ? { count, expiresAt: Date.now() + ttl } : null;
}

function tooManyRequests(retryAfterMs: number): ApiError {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new ApiError("RATE_LIMIT_EXCEEDED", undefined, undefined, {
    "Retry-After": String(seconds),
  });
}

function unavailable(): ApiError {
  return new ApiError(
    "AUTH_RATE_LIMIT_UNAVAILABLE",
    undefined,
    undefined,
    { "Retry-After": "30" },
  );
}

async function withBackend<T>(
  memoryOperation: () => T | Promise<T>,
  redisOperation: () => Promise<T>,
): Promise<T> {
  const mode = backend();
  if (mode === "disabled") return memoryOperation();
  if (mode === "memory") return memoryOperation();
  try {
    return await redisOperation();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
}

export async function beginLoginAttempt(input: {
  email: string;
  clientIp: string | null;
}): Promise<void> {
  if (backend() === "disabled") return;
  const rateKeys = keys(input);
  if (rateKeys.totalIp) {
    const total = await withBackend(
      () => memoryIncrement(rateKeys.totalIp!, TOTAL_IP_WINDOW_MS),
      () => redisIncrement(rateKeys.totalIp!, TOTAL_IP_WINDOW_MS),
    );
    if (total.count > TOTAL_IP_LIMIT) throw tooManyRequests(total.expiresAt - Date.now());
  }
  const [failedIp, failedPair] = await Promise.all([
    rateKeys.failedIp
      ? withBackend(() => memoryGet(rateKeys.failedIp!), () => redisGet(rateKeys.failedIp!))
      : Promise.resolve(null),
    withBackend(() => memoryGet(rateKeys.failedPair), () => redisGet(rateKeys.failedPair)),
  ]);
  const blocked = [
    failedIp && failedIp.count >= FAILED_IP_LIMIT ? failedIp : null,
    failedPair && failedPair.count >= FAILED_PAIR_LIMIT ? failedPair : null,
  ].filter((entry): entry is WindowEntry => Boolean(entry));
  if (blocked.length > 0) {
    throw tooManyRequests(Math.max(...blocked.map((entry) => entry.expiresAt - Date.now())));
  }
}

export async function recordLoginFailure(input: {
  email: string;
  clientIp: string | null;
}): Promise<void> {
  if (backend() === "disabled") return;
  const rateKeys = keys(input);
  const [failedIp, failedPair] = await Promise.all([
    rateKeys.failedIp
      ? withBackend(
          () => memoryIncrement(rateKeys.failedIp!, FAILED_WINDOW_MS),
          () => redisIncrement(rateKeys.failedIp!, FAILED_WINDOW_MS),
        )
      : Promise.resolve(null),
    withBackend(
      () => memoryIncrement(rateKeys.failedPair, FAILED_WINDOW_MS),
      () => redisIncrement(rateKeys.failedPair, FAILED_WINDOW_MS),
    ),
  ]);
  if (
    (failedIp && failedIp.count >= FAILED_IP_LIMIT) ||
    failedPair.count >= FAILED_PAIR_LIMIT
  ) {
    const retryAt = Math.max(failedIp?.expiresAt ?? 0, failedPair.expiresAt);
    throw tooManyRequests(retryAt - Date.now());
  }
}

export async function recordLoginSuccess(input: {
  email: string;
  clientIp: string | null;
}): Promise<void> {
  if (backend() === "disabled") return;
  const pairKey = keys(input).failedPair;
  await withBackend(
    () => {
      memoryStore().delete(pairKey);
    },
    async () => {
      const redis = redisClient();
      await ensureRedisConnected(redis);
      await redis.del(pairKey);
    },
  );
}

export function resetMemoryLoginRateLimitForTests(): void {
  globalState.loginRateLimitMemory?.clear();
}
