import { describe, expect, it } from "vitest";
import { parseTrustedClientIp } from "./client-address";

describe("可信客户端 IP", () => {
  it("只接受配置的单值 IPv4/IPv6 头", () => {
    expect(parseTrustedClientIp(new Headers({ "x-real-ip": "203.0.113.8" }), "x-real-ip"))
      .toBe("203.0.113.8");
    expect(parseTrustedClientIp(new Headers({ "x-real-ip": "2001:db8::1" }), "x-real-ip"))
      .toBe("2001:db8::1");
  });

  it("拒绝可伪造的多段值和非法地址", () => {
    expect(parseTrustedClientIp(new Headers({ "x-real-ip": "1.1.1.1, 2.2.2.2" }), "x-real-ip"))
      .toBeNull();
    expect(parseTrustedClientIp(new Headers({ "x-real-ip": "not-an-ip" }), "x-real-ip"))
      .toBeNull();
    expect(parseTrustedClientIp(new Headers({ "x-real-ip": "1.1.1.1" }), undefined)).toBeNull();
  });
});
