import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findMembership: vi.fn(),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  beginLoginAttempt: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    user: { findFirst: mocks.findUser },
    membership: { findFirst: mocks.findMembership },
  },
}));
vi.mock("@/server/auth/password", () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock("@/server/auth/session", () => ({
  createSession: mocks.createSession,
  destroySession: vi.fn(),
  setSessionActiveOrg: vi.fn(),
}));
vi.mock("@/server/auth/login-protection", () => ({
  beginLoginAttempt: mocks.beginLoginAttempt,
  recordLoginFailure: mocks.recordLoginFailure,
  recordLoginSuccess: mocks.recordLoginSuccess,
}));
vi.mock("@/server/modules/audit/audit.service", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { login } from "./auth.service";

describe("登录服务", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.beginLoginAttempt.mockResolvedValue(undefined);
    mocks.recordLoginFailure.mockResolvedValue(undefined);
    mocks.recordLoginSuccess.mockResolvedValue(undefined);
  });

  it("未知用户仍执行同参数 Argon2 dummy hash 校验", async () => {
    mocks.findUser.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(false);
    await expect(login({ email: "Nobody@Example.com", password: "wrong", ip: null }))
      .rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    expect(mocks.verifyPassword).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/),
      "wrong",
    );
    expect(mocks.recordLoginFailure).toHaveBeenCalledWith({
      email: "nobody@example.com",
      clientIp: null,
    });
  });

  it("禁用用户与错误密码使用相同响应且计入失败", async () => {
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      passwordHash: "stored-hash",
      status: "disabled",
    });
    mocks.verifyPassword.mockResolvedValue(true);
    await expect(login({ email: "user@example.com", password: "correct", ip: "203.0.113.1" }))
      .rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    expect(mocks.recordLoginFailure).toHaveBeenCalledOnce();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("成功登录清理账号组合失败桶并创建受限会话", async () => {
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      passwordHash: "stored-hash",
      status: "active",
    });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.findMembership.mockResolvedValue({ tenantId: "org-1" });
    await login({
      email: "User@Example.com",
      password: "correct",
      ip: "203.0.113.1",
      userAgent: "test-agent",
    });
    expect(mocks.recordLoginSuccess).toHaveBeenCalledWith({
      email: "user@example.com",
      clientIp: "203.0.113.1",
    });
    expect(mocks.createSession).toHaveBeenCalledWith({
      userId: "user-1",
      activeOrgId: "org-1",
      ip: "203.0.113.1",
      userAgent: "test-agent",
    });
  });
});
