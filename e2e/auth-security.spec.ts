import { expect, test, type BrowserContext } from "@playwright/test";

test.describe("认证与生产安全基线", () => {
  test("响应包含安全头，跨源变更请求被拒绝", async ({ request, baseURL }) => {
    const pageResponse = await request.get("/login");
    expect(pageResponse.headers()["x-content-type-options"]).toBe("nosniff");
    expect(pageResponse.headers()["x-frame-options"]).toBe("DENY");
    expect(pageResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

    const crossOrigin = await request.post("/api/v1/auth/login", {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      data: { email: "admin@demo.com", password: "demo1234" },
    });
    expect(crossOrigin.status()).toBe(403);
    expect((await crossOrigin.json()).error.code).toBe("PERMISSION_DENIED");

    const sameOrigin = await request.post("/api/v1/auth/login", {
      headers: { origin: baseURL!, "sec-fetch-site": "same-origin" },
      data: { email: "unknown-security-check@example.com", password: "wrong" },
    });
    expect(sameOrigin.status()).toBe(401);
  });

  test("同一来源与邮箱第 5 次失败触发 429", async ({ request, baseURL }) => {
    const email = `rate-limit-${Date.now()}@example.com`;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await request.post("/api/v1/auth/login", {
        headers: { origin: baseURL!, "sec-fetch-site": "same-origin" },
        data: { email, password: `wrong-${attempt}` },
      });
      expect(response.status()).toBe(401);
    }
    const limited = await request.post("/api/v1/auth/login", {
      headers: { origin: baseURL!, "sec-fetch-site": "same-origin" },
      data: { email, password: "wrong-5" },
    });
    expect(limited.status()).toBe(429);
    expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
    expect((await limited.json()).error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  test("每个用户最多保留 5 个活跃会话", async ({ browser, baseURL }) => {
    const contexts: BrowserContext[] = [];
    try {
      for (let index = 0; index < 6; index += 1) {
        const context = await browser.newContext({ baseURL });
        contexts.push(context);
        const response = await context.request.post("/api/v1/auth/login", {
          headers: { origin: baseURL!, "sec-fetch-site": "same-origin" },
          data: { email: "viewer@demo.com", password: "demo1234" },
        });
        expect(response.status()).toBe(200);
      }
      const oldestSession = await contexts[0]!.request.get("/api/v1/auth/me");
      expect(oldestSession.status()).toBe(401);
      const newestSession = await contexts[5]!.request.get("/api/v1/auth/me");
      expect(newestSession.status()).toBe(200);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});
