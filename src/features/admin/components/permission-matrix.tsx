"use client";

import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminRoleDto, AdminUsersPageDto } from "@/shared/schemas/admin";
import type { Permission } from "@/shared/constants/permissions";

function roleAllows(role: AdminRoleDto, permission: Permission): boolean {
  return role.permissions.some((item) => item === "*" || item === permission);
}

export function PermissionMatrix({
  roles,
  permissions,
}: {
  roles: AdminRoleDto[];
  permissions: AdminUsersPageDto["permissions"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">权限矩阵</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 font-medium">权限</th>
              {roles.map((role) => (
                <th key={role.key} className="px-3 py-2 text-center font-medium">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.key} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <div>{permission.label}</div>
                  <div className="text-xs text-muted-foreground">{permission.key}</div>
                </td>
                {roles.map((role) => {
                  const allowed = roleAllows(role, permission.key);
                  return (
                    <td key={role.key} className="px-3 py-2 text-center">
                      {allowed && <Check className="mx-auto size-4 text-success" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
