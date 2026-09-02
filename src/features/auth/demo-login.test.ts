import { describe, expect, it } from "vitest";
import { getDemoLoginConfig } from "./demo-login";

describe("生产登录页演示信息隔离", () => {
  it("生产环境默认不向客户端下发演示账号与密码", () => {
    expect(getDemoLoginConfig({ NODE_ENV: "production" })).toBeNull();
  });

  it("即使误设开关，生产环境也不提供演示账号", () => {
    const config = getDemoLoginConfig({
      NODE_ENV: "production",
      ENABLE_DEMO_LOGIN: "true",
      DEMO_LOGIN_PASSWORD: "isolated-demo-password",
    });

    expect(config).toBeNull();
  });
});
