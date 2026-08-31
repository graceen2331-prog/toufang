import { describe, expect, it } from "vitest";
import { getDemoLoginConfig } from "./demo-login";

describe("生产登录页演示信息隔离", () => {
  it("生产环境默认不向客户端下发演示账号与密码", () => {
    expect(getDemoLoginConfig({ NODE_ENV: "production" })).toBeNull();
  });

  it("只有显式开启时才在生产环境提供演示账号", () => {
    const config = getDemoLoginConfig({
      NODE_ENV: "production",
      ENABLE_DEMO_LOGIN: "true",
      DEMO_LOGIN_PASSWORD: "isolated-demo-password",
    });

    expect(config?.password).toBe("isolated-demo-password");
    expect(config?.accounts[0]?.email).toBe("admin@demo.com");
  });
});
