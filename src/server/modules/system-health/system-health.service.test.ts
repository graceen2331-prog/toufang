import { describe, expect, it, vi } from "vitest";
import { createReadinessProbe, getLivenessSnapshot } from "./system-health.service";

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
      createReadinessProbe({
        checkDatabase: vi.fn().mockResolvedValue(undefined),
        checkRedis: vi.fn().mockResolvedValue(undefined),
        now: () => NOW,
      })(),
    ).resolves.toEqual({
      status: "ok",
      checked_at: NOW.toISOString(),
      checks: { database: "ok", redis: "ok" },
    });
  });

  it("任一依赖失败时安全返回不可用且不暴露错误详情", async () => {
    await expect(
      createReadinessProbe({
        checkDatabase: vi.fn().mockRejectedValue(new Error("postgres secret host")),
        checkRedis: vi.fn().mockResolvedValue(undefined),
        now: () => NOW,
      })(),
    ).resolves.toEqual({
      status: "unavailable",
      checked_at: NOW.toISOString(),
      checks: { database: "unavailable", redis: "ok" },
    });
  });

  it("依赖超时时返回不可用", async () => {
    await expect(
      createReadinessProbe({
        checkDatabase: () => new Promise(() => undefined),
        checkRedis: vi.fn().mockResolvedValue(undefined),
        now: () => NOW,
        timeoutMs: 5,
      })(),
    ).resolves.toMatchObject({
      status: "unavailable",
      checks: { database: "unavailable", redis: "ok" },
    });
  });

  it("并发探测合并为一次依赖检查", async () => {
    let releaseDatabase: (() => void) | undefined;
    const checkDatabase = vi.fn(
      () => new Promise<void>((resolve) => {
        releaseDatabase = resolve;
      }),
    );
    const checkRedis = vi.fn().mockResolvedValue(undefined);
    const probe = createReadinessProbe({ checkDatabase, checkRedis, cacheTtlMs: 0 });

    const snapshots = Promise.all(Array.from({ length: 100 }, () => probe()));
    releaseDatabase?.();

    await expect(snapshots).resolves.toHaveLength(100);
    expect(checkDatabase).toHaveBeenCalledTimes(1);
    expect(checkRedis).toHaveBeenCalledTimes(1);
  });

  it("短缓存过期后重新检查并反映依赖恢复", async () => {
    let databaseAvailable = false;
    let currentTime = 1_000;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => currentTime);
    const probe = createReadinessProbe({
      checkDatabase: async () => {
        if (!databaseAvailable) throw new Error("暂不可用");
      },
      checkRedis: vi.fn().mockResolvedValue(undefined),
      now: () => NOW,
      cacheTtlMs: 300,
    });

    await expect(probe()).resolves.toMatchObject({ status: "unavailable" });
    databaseAvailable = true;
    currentTime += 301;
    await expect(probe()).resolves.toMatchObject({ status: "ok" });
    dateNow.mockRestore();
  });
});
