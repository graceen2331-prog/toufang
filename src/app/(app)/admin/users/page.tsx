"use client";

import { Suspense } from "react";
import { AdminUserTable } from "@/features/admin/components/admin-user-table";
import { PermissionMatrix } from "@/features/admin/components/permission-matrix";
import { useAdminUsersPage } from "@/features/admin/queries";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminUsersPage() {
  return (
    <Suspense>
      <AdminUsersPageInner />
    </Suspense>
  );
}

function AdminUsersPageInner() {
  const usersPage = useAdminUsersPage();
  return (
    <div className="space-y-6">
      <PageHeader
        title="组织成员"
        description="管理组织成员角色，并查看 RBAC 权限矩阵。"
      />
      <AdminUserTable
        users={usersPage.data?.users ?? []}
        roles={usersPage.data?.roles ?? []}
        isLoading={usersPage.isLoading}
        isError={usersPage.isError}
        error={usersPage.error}
        onRetry={() => usersPage.refetch()}
      />
      {usersPage.data && (
        <PermissionMatrix roles={usersPage.data.roles} permissions={usersPage.data.permissions} />
      )}
    </div>
  );
}
