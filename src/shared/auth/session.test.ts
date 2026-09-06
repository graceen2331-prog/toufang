import { describe, expect, it } from "vitest";
import { LEGACY_SESSION_COOKIE, sessionCookieName } from "./session";

describe("会话 Cookie 名称", () => {
  it("生产使用 __Host- 前缀，本地保持兼容名称", () => {
    expect(sessionCookieName({ NODE_ENV: "production" })).toBe("__Host-tf_session");
    expect(sessionCookieName({ NODE_ENV: "development" })).toBe(LEGACY_SESSION_COOKIE);
  });
});
