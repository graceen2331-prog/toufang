import { beforeAll, describe, expect, it } from "vitest";
import { decryptJson, encryptJson, isEncrypted } from "./crypto";

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = "test-key-for-vitest";
});

describe("敏感字段加密", () => {
  it("加密后可解密回原值", () => {
    const value = { email: "kol@example.com", wechat: "wx_123", phone: "13800000000" };
    const encrypted = encryptJson(value);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted.data).not.toContain("example.com");
    expect(decryptJson(encrypted)).toEqual(value);
  });

  it("密文被篡改时解密返回 null 而不是抛错", () => {
    const encrypted = encryptJson({ secret: "value" });
    const tampered = { ...encrypted, data: encrypted.data.slice(0, -4) + "AAAA" };
    expect(decryptJson(tampered)).toBeNull();
  });

  it("非加密结构返回 null", () => {
    expect(decryptJson({ email: "plain" })).toBeNull();
    expect(decryptJson(null)).toBeNull();
    expect(decryptJson("string")).toBeNull();
  });

  it("同一明文两次加密产生不同密文（随机 IV）", () => {
    const a = encryptJson({ v: 1 });
    const b = encryptJson({ v: 1 });
    expect(a.data).not.toBe(b.data);
  });
});
