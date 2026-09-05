import { describe, expect, it, vi } from "vitest";
import { getLivenessSnapshot, getReadinessSnapshot } from "./system-health.service";

const NOW = new Date("2026-09-05T03:00:00.000Z");

describe("system health", () => {
  it("存活探针不依赖外部服务", () => {
    expect(getLivenessSnapshot(() => NOW)).toEqual({
      status: "ok",
      checked_at: NOW.toISOString(),
    });
  });

  it("数据库与 Redis 均可用时返回就绪", async () => {
    await expect(
      getReadinessSnapshot({
        checkDatabase: vi.fn().mockResolvedValue(undefined),
        checkRedis: vi.fn().mockResolvedValue(undefined),
        now: () => NOW,
      }),
    ).resolves.toEqual({
      status: "ok",
      checked_at: NOW.toISOString(),
      checks: { database: "ok", redis: "ok" },
    });
  });

  it("任一依赖失败时安全返回不可用且不暴露错误详情", async () => {
    await expect(
      getReadinessSnapshot({
        checkDatabase: vi.fn().mockRejectedValue(new Error("postgres secret host")),
        checkRedis: vi.fn().mockResolvedValue(undefined),
        now: () => NOW,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      checked_at: NOW.toISOString(),
      checks: { database: "unavailable", redis: "ok" },
    });
  });

  it("依赖超时时返回不可用", async () => {
    await expect(
      getReadinessSnapshot({
        checkDatabase: () => new Promise(() => undefined),
        checkRedis: vi.fn().mockResolvedValue(undefined),
        now: () => NOW,
        timeoutMs: 5,
      }),
    ).resolves.toMatchObject({
      status: "unavailable",
      checks: { database: "unavailable", redis: "ok" },
    });
  });
});
