import { describe, expect, it } from "vitest";
import {
  assertOwnedRuntimeDirectory,
  assertOwnedRuntimeTsconfig,
  assertSafeE2ETargets,
  createIsolatedTestSecurityEnv,
  createRuntimeLayout,
  normalizeDatabaseTarget,
  normalizeRedisTarget,
  resolveE2EMode,
} from "../../scripts/lib/e2e-environment.mjs";

describe("E2E 外部环境模式", () => {
  it("外部数据库和 Redis 必须成对提供", () => {
    expect(() => resolveE2EMode({ E2E_DATABASE_URL: "postgresql://db/app_e2e" })).toThrow(
      "必须同时提供",
    );
    expect(
      resolveE2EMode({
        E2E_DATABASE_URL: "postgresql://db/app_e2e",
        E2E_REDIS_URL: "redis://cache:6379/1",
      }),
    ).toBe("external");
  });

  it("没有外部连接时使用本地 Compose", () => {
    expect(resolveE2EMode({})).toBe("local-compose");
  });
});

describe("E2E 连接安全边界", () => {
  it("规范化时忽略数据库凭证、查询和默认端口", () => {
    expect(normalizeDatabaseTarget("postgresql://user:a@DB/app_e2e?schema=one").key).toBe(
      normalizeDatabaseTarget("postgres://other:b@db:5432/app_e2e?schema=two").key,
    );
  });

  it("拒绝与主数据库等价的目标", () => {
    expect(() =>
      assertSafeE2ETargets({
        databaseUrl: "postgresql://test:new@db:5432/app_e2e?schema=other",
        redisUrl: "redis://cache:6380/0",
        mainDatabaseUrl: "postgres://main:old@DB/app_e2e",
        mainRedisUrl: "redis://cache:6379/0",
      }),
    ).toThrow("同一数据库");
  });

  it("拒绝没有独立测试标记的数据库名", () => {
    expect(() =>
      assertSafeE2ETargets({
        databaseUrl: "postgresql://db/production",
        redisUrl: "redis://cache:6380/0",
      }),
    ).toThrow("e2e 或 test");
  });

  it("拒绝与主 Redis 等价的目标，即使凭证不同", () => {
    expect(normalizeRedisTarget("redis://a@CACHE/2").key).toBe(
      normalizeRedisTarget("redis://b@cache:6379/02").key,
    );
    expect(() =>
      assertSafeE2ETargets({
        databaseUrl: "postgresql://db/app_test",
        redisUrl: "redis://new@cache/2",
        mainRedisUrl: "redis://old@CACHE:6379/02",
      }),
    ).toThrow("同一 Redis DB");
  });
});

describe("E2E 运行资源所有权", () => {
  it("为每次运行生成精确且隔离的资源名", () => {
    expect(createRuntimeLayout("/workspace", "abc-123")).toEqual({
      composeProject: "toufang-e2e-abc-123",
      queuePrefix: "e2e-abc-123",
      relativeDistDir: ".next-e2e/abc-123",
      absoluteDistDir: "/workspace/.next-e2e/abc-123",
      relativeTsconfigPath: "tsconfig.e2e-abc-123.json",
      absoluteTsconfigPath: "/workspace/tsconfig.e2e-abc-123.json",
    });
  });

  it("只允许清理当前 runId 对应的叶子目录", () => {
    expect(
      assertOwnedRuntimeDirectory("/workspace", "abc-123", "/workspace/.next-e2e/abc-123"),
    ).toBe("/workspace/.next-e2e/abc-123");
    expect(() =>
      assertOwnedRuntimeDirectory("/workspace", "abc-123", "/workspace/.next-e2e"),
    ).toThrow("拒绝清理");
    expect(() => assertOwnedRuntimeDirectory("/workspace", "abc-123", "/workspace/.next")).toThrow(
      "拒绝清理",
    );
    expect(
      assertOwnedRuntimeTsconfig("/workspace", "abc-123", "/workspace/tsconfig.e2e-abc-123.json"),
    ).toBe("/workspace/tsconfig.e2e-abc-123.json");
    expect(() =>
      assertOwnedRuntimeTsconfig("/workspace", "abc-123", "/workspace/tsconfig.json"),
    ).toThrow("拒绝清理");
  });
});

describe("本地隔离测试密钥", () => {
  it("为本地 Compose 生成三类互不复用的密钥", () => {
    let index = 0;
    const env = createIsolatedTestSecurityEnv(
      "local-compose",
      () => `test-secret-${++index}`.padEnd(32, "x"),
    );
    expect(Object.values(env)).toHaveLength(3);
    expect(new Set(Object.values(env)).size).toBe(3);
    expect(env).toEqual({
      DATA_ENCRYPTION_KEY: "test-secret-1".padEnd(32, "x"),
      PAYMENT_FINGERPRINT_KEY: "test-secret-2".padEnd(32, "x"),
      AUTH_RATE_LIMIT_HMAC_KEY: "test-secret-3".padEnd(32, "x"),
    });
  });

  it("外部隔离环境必须继续使用调用方提供的稳定密钥", () => {
    expect(createIsolatedTestSecurityEnv("external")).toEqual({});
  });
});
