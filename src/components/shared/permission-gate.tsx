"use client";

import { useMe } from "@/features/auth/queries";
import { roleHasPermission, type Permission } from "@/shared/constants/permissions";
import type { ReactNode } from "react";

/** 权限门：无权限时隐藏（或渲染 fallback） */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { data: me } = useMe();
  if (!me) return null;
  if (!roleHasPermission(me.permissions, permission)) return <>{fallback}</>;
  return <>{children}</>;
}
