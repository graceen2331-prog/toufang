import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginLoginAttempt,
  recordLoginFailure,
  recordLoginSuccess,
  resetMemoryLoginRateLimitForTests,
} from "./login-protection";

const input = { email: "User@Example.com", clientIp: "203.0.113.10" };

describe("登录防爆破", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_RATE_LIMIT_BACKEND", "memory");
    vi.stubEnv("AUTH_RATE_LIMIT_HMAC_KEY", "test-login-rate-limit-hmac-key-32-bytes");
    resetMemoryLoginRateLimitForTests();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("同一 IP 与邮箱第 5 次失败返回 429 和 Retry-After", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await beginLoginAttempt(input);
      await recordLoginFailure(input);
    }
    await beginLoginAttempt(input);
    await expect(recordLoginFailure(input)).rejects.toMatchObject({
      code: "RATE_LIMIT_EXCEEDED",
      responseHeaders: { "Retry-After": expect.any(String) },
    });
  });

  it("成功登录清除 IP+邮箱失败桶", async () => {
    await beginLoginAttempt(input);
    await recordLoginFailure(input);
    await recordLoginSuccess(input);
    await expect(beginLoginAttempt(input)).resolves.toBeUndefined();
  });

  it("单 IP 5 分钟内最多进入 60 次密码校验", async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await beginLoginAttempt({ email: `user-${attempt}@example.com`, clientIp: input.clientIp });
    }
    await expect(beginLoginAttempt({ email: "overflow@example.com", clientIp: input.clientIp }))
      .rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
  });
});
