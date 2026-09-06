import { expect, test } from "./fixtures";

test.describe("部署健康探针", () => {
  test("无需会话即可检查 Web 存活与基础依赖就绪", async ({ request }) => {
    const live = await request.get("/api/health/live");
    expect(live.status()).toBe(200);
    expect(live.headers()["cache-control"]).toContain("no-store");
    await expect(live.json()).resolves.toMatchObject({ status: "ok" });

    const ready = await request.get("/api/health/ready");
    expect(ready.status()).toBe(200);
    expect(ready.headers()["cache-control"]).toContain("no-store");
    await expect(ready.json()).resolves.toMatchObject({
      status: "ok",
      checks: { database: "ok", redis: "ok" },
    });
  });
});
