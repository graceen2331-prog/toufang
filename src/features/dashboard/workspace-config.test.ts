import { describe, expect, it } from "vitest";
import { SYSTEM_ROLES } from "@/shared/constants/permissions";
import { dashboardPermissionFingerprint, resolveDashboardPreset } from "./workspace-config";

function permissionsFor(roleKey: keyof typeof SYSTEM_ROLES): string[] {
  return [...SYSTEM_ROLES[roleKey]!.permissions];
}

describe("角色化工作台配置", () => {
  it("管理员通配符可看到经营资源与创建入口", () => {
    const preset = resolveDashboardPreset("admin", permissionsFor("admin"));

    expect(preset.title).toBe("经营总览");
    expect(preset.resources).toEqual(["analytics", "campaigns", "approvals", "reports"]);
    expect(preset.actions.map((action) => action.key)).toContain("new_campaign");
  });

  it("角色预设仍以实际权限为最终边界", () => {
    const preset = resolveDashboardPreset("manager", [
      "campaign:read",
      "campaign:write",
      "analytics:read",
      "report:read",
    ]);

    expect(preset.resources).toEqual(["campaigns", "analytics", "reports"]);
    expect(preset.actions.map((action) => action.key)).not.toContain("approvals");
    expect(preset.actions.map((action) => action.key)).toContain("new_campaign");
  });

  it("只读角色不出现任何写操作", () => {
    const preset = resolveDashboardPreset("viewer", permissionsFor("viewer"));

    expect(preset.roleLabel).toBe("只读工作台");
    expect(preset.actions.map((action) => action.key)).not.toContain("new_campaign");
    expect(preset.actions.every((action) => action.permission.endsWith(":read"))).toBe(true);
  });

  it("未知角色按权限生成安全降级工作台", () => {
    const preset = resolveDashboardPreset("custom_operator", ["outreach:read", "contract:read"]);

    expect(preset.roleLabel).toBe("自定义角色");
    expect(preset.resources).toEqual(["outreach", "contracts"]);
    expect(preset.actions.map((action) => action.key)).toEqual(["outreach", "contracts"]);
  });
});

describe("工作台权限指纹", () => {
  it("排序并去重，避免同一权限集合产生不同缓存作用域", () => {
    expect(dashboardPermissionFingerprint(["report:read", "campaign:read", "report:read"])).toBe(
      "campaign:read|report:read",
    );
  });

  it("空权限集合使用明确占位符", () => {
    expect(dashboardPermissionFingerprint([])).toBe("none");
  });
});
