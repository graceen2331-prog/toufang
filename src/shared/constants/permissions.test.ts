import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, SYSTEM_ROLES, roleHasPermission } from "./permissions";

describe("roleHasPermission", () => {
  it("通配符拥有一切权限", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(roleHasPermission(["*"], p)).toBe(true);
    }
  });

  it("普通角色仅拥有列出的权限", () => {
    expect(roleHasPermission(["brand:read"], "brand:read")).toBe(true);
    expect(roleHasPermission(["brand:read"], "brand:write")).toBe(false);
  });
});

describe("系统角色矩阵", () => {
  it("viewer 没有任何写权限与敏感权限", () => {
    const viewer = SYSTEM_ROLES.viewer!.permissions as string[];
    expect(viewer.some((p) => p.endsWith(":write"))).toBe(false);
    expect(viewer).not.toContain("creator:contact:read");
    expect(viewer).not.toContain("payment:approve");
    expect(viewer.some((p) => p.startsWith("admin:"))).toBe(false);
  });

  it("finance 拥有付款审批但没有达人写权限", () => {
    const finance = SYSTEM_ROLES.finance!.permissions as string[];
    expect(finance).toContain("payment:approve");
    expect(finance).not.toContain("creator:write");
  });

  it("指标录入权限只授予运营与内容角色", () => {
    expect(SYSTEM_ROLES.manager!.permissions).toContain("analytics:write");
    expect(SYSTEM_ROLES.kol_manager!.permissions).toContain("analytics:write");
    expect(SYSTEM_ROLES.content_manager!.permissions).toContain("analytics:write");
    expect(SYSTEM_ROLES.viewer!.permissions).not.toContain("analytics:write");
  });

  it("所有系统角色的权限字符串都在权限表中", () => {
    for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
      for (const p of def.permissions) {
        if (p === "*") continue;
        expect(ALL_PERMISSIONS, `角色 ${key} 引用了未定义权限 ${p}`).toContain(p);
      }
    }
  });
});
