"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminRoleDto, AdminUserDto } from "@/shared/schemas/admin";
import { useUpdateAdminUser } from "@/features/admin/queries";

function hasWildcardPermission(permissions: AdminUserDto["permissions"]): boolean {
  return permissions.some((permission) => permission === "*");
}

export function AdminUserTable({
  users,
  roles,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  users: AdminUserDto[];
  roles: AdminRoleDto[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const update = useUpdateAdminUser();
  const columns = useMemo<ColumnDef<AdminUserDto, unknown>[]>(
    () => [
      {
        header: "成员",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        header: "状态",
        cell: ({ row }) => (
          <Badge variant={row.original.membership_status === "active" ? "secondary" : "outline"}>
            {row.original.membership_status === "active" ? "启用" : "停用"}
          </Badge>
        ),
      },
      {
        header: "角色",
        cell: ({ row }) => (
          <Select
            value={row.original.role_key}
            onValueChange={(roleKey) =>
              update.mutate({ userId: row.original.user_id, input: { role_key: roleKey } })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.key} value={role.key}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        header: "权限数",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {hasWildcardPermission(row.original.permissions)
              ? "全部"
              : row.original.permissions.length}
          </span>
        ),
      },
    ],
    [roles, update],
  );

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={onRetry}
      isEmpty={users.length === 0}
      emptyTitle="暂无组织成员"
    >
      <DataTable columns={columns} data={users} />
    </AsyncBoundary>
  );
}
