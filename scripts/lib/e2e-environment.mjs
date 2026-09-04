import { randomBytes } from "node:crypto";
import path from "node:path";

const TEST_DATABASE_TOKEN = /(^|[^a-z0-9])(e2e|test)([^a-z0-9]|$)/i;

function requiredUrl(raw, label, protocols) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} 不是合法 URL`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${label} 协议必须是 ${protocols.join(" 或 ")}`);
  }
  if (!parsed.hostname) throw new Error(`${label} 缺少主机名`);
  return parsed;
}

function decodePathSegment(parsed, label) {
  try {
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error(`${label} 路径编码无效`);
  }
}

export function normalizeDatabaseTarget(raw, label = "E2E_DATABASE_URL") {
  const parsed = requiredUrl(raw, label, ["postgres:", "postgresql:"]);
  const database = decodePathSegment(parsed, label);
  if (!database || database.includes("/")) throw new Error(`${label} 必须指定单一数据库名`);
  return {
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    database,
    key: `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${database}`,
  };
}

export function normalizeRedisTarget(raw, label = "E2E_REDIS_URL") {
  const parsed = requiredUrl(raw, label, ["redis:", "rediss:"]);
  const rawDatabase = decodePathSegment(parsed, label) || "0";
  if (!/^\d+$/.test(rawDatabase)) throw new Error(`${label} 的 Redis DB 必须是非负整数`);
  const database = String(Number(rawDatabase));
  return {
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || "6379",
    database,
    key: `${parsed.hostname.toLowerCase()}:${parsed.port || "6379"}/${database}`,
  };
}

export function resolveE2EMode(env) {
  const hasDatabase = Boolean(env.E2E_DATABASE_URL?.trim());
  const hasRedis = Boolean(env.E2E_REDIS_URL?.trim());
  if (hasDatabase !== hasRedis) {
    throw new Error("外部隔离模式必须同时提供 E2E_DATABASE_URL 和 E2E_REDIS_URL");
  }
  return hasDatabase ? "external" : "local-compose";
}

/**
 * @param {{
 *   databaseUrl: string;
 *   redisUrl: string;
 *   mainDatabaseUrl?: string;
 *   mainRedisUrl?: string;
 * }} targets
 */
export function assertSafeE2ETargets({ databaseUrl, redisUrl, mainDatabaseUrl, mainRedisUrl }) {
  const database = normalizeDatabaseTarget(databaseUrl);
  if (!TEST_DATABASE_TOKEN.test(database.database)) {
    throw new Error("E2E 数据库名必须包含独立的 e2e 或 test 标记");
  }
  if (mainDatabaseUrl) {
    const mainDatabase = normalizeDatabaseTarget(mainDatabaseUrl, "DATABASE_URL");
    if (database.key === mainDatabase.key) {
      throw new Error("E2E_DATABASE_URL 与主 DATABASE_URL 指向同一数据库，已拒绝执行");
    }
  }

  const redis = normalizeRedisTarget(redisUrl);
  if (mainRedisUrl) {
    const mainRedis = normalizeRedisTarget(mainRedisUrl, "REDIS_URL");
    if (redis.key === mainRedis.key) {
      throw new Error("E2E_REDIS_URL 与主 REDIS_URL 指向同一 Redis DB，已拒绝执行");
    }
  }
  return { database, redis };
}

export function createE2ERunId(now = Date.now(), entropy = randomBytes(5).toString("hex")) {
  return `${now.toString(36)}-${entropy
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10)}`;
}

export function createRuntimeLayout(projectRoot, runId) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(runId)) throw new Error("E2E runId 格式无效");
  const relativeDistDir = path.posix.join(".next-e2e", runId);
  const relativeTsconfigPath = `tsconfig.e2e-${runId}.json`;
  return {
    composeProject: `toufang-e2e-${runId}`,
    queuePrefix: `e2e-${runId}`,
    relativeDistDir,
    absoluteDistDir: path.resolve(projectRoot, relativeDistDir),
    relativeTsconfigPath,
    absoluteTsconfigPath: path.resolve(projectRoot, relativeTsconfigPath),
  };
}

export function assertOwnedRuntimeDirectory(projectRoot, runId, candidate) {
  const expected = path.resolve(projectRoot, ".next-e2e", runId);
  const actual = path.resolve(candidate);
  const parent = path.resolve(projectRoot, ".next-e2e");
  if (actual !== expected || path.dirname(actual) !== parent || path.basename(actual) !== runId) {
    throw new Error("拒绝清理不属于当前 E2E 运行的目录");
  }
  return actual;
}

export function assertOwnedRuntimeTsconfig(projectRoot, runId, candidate) {
  const expected = path.resolve(projectRoot, `tsconfig.e2e-${runId}.json`);
  const actual = path.resolve(candidate);
  if (actual !== expected || path.dirname(actual) !== path.resolve(projectRoot)) {
    throw new Error("拒绝清理不属于当前 E2E 运行的 tsconfig");
  }
  return actual;
}
