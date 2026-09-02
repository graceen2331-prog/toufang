import { describe, expect, it } from "vitest";
import { productionEnvironmentIssues, sessionSecurityConfig } from "./env";

function productionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@db:5432/app",
    REDIS_URL: "rediss://cache.example.com:6380",
    APP_ORIGIN: "https://app.example.com",
    DATA_ENCRYPTION_KEY: "data-encryption-key-with-at-least-32-bytes",
    PAYMENT_FINGERPRINT_KEY: "payment-fingerprint-key-with-at-least-32-bytes",
    AUTH_RATE_LIMIT_HMAC_KEY: "login-rate-limit-key-with-at-least-32-bytes",
    AUTH_CLIENT_IP_HEADER: "x-real-ip",
  };
}

describe("生产环境配置校验", () => {
  it("接受完整的生产配置", () => {
    expect(productionEnvironmentIssues(productionEnv())).toEqual([]);
  });

  it("拒绝开发默认密钥、HTTP 来源和不可信 XFF", () => {
    const issues = productionEnvironmentIssues({
      ...productionEnv(),
      APP_ORIGIN: "http://app.example.com",
      DATA_ENCRYPTION_KEY: "dev-encryption-key-change-me",
      AUTH_CLIENT_IP_HEADER: "x-forwarded-for",
      ENABLE_DEMO_LOGIN: "true",
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("APP_ORIGIN"),
        expect.stringContaining("DATA_ENCRYPTION_KEY"),
        expect.stringContaining("x-forwarded-for"),
        expect.stringContaining("ENABLE_DEMO_LOGIN"),
      ]),
    );
  });

  it("拒绝在不同安全用途之间复用密钥", () => {
    const env = productionEnv();
    env.PAYMENT_FINGERPRINT_KEY = env.DATA_ENCRYPTION_KEY;
    expect(productionEnvironmentIssues(env)).toContain(
      "数据加密、付款指纹与登录限流密钥不得复用",
    );
  });

  it("会话默认使用 12 小时绝对期限和 2 小时闲置期限", () => {
    expect(sessionSecurityConfig({ NODE_ENV: "test" })).toMatchObject({
      absoluteTtlMs: 12 * 60 * 60 * 1000,
      idleTtlMs: 2 * 60 * 60 * 1000,
      maxActiveSessions: 5,
    });
  });
});
