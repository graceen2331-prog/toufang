"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useMe } from "@/features/auth/queries";
import { roleHasPermission, type Permission } from "@/shared/constants/permissions";

/**
 * 监测页权限门：挂载前保持服务端与客户端首屏一致，避免已水合的用户缓存造成 hydration mismatch。
 */
export function HydratedPermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { data: me } = useMe();

  if (!mounted || !me) return null;
  if (!roleHasPermission(me.permissions, permission)) return <>{fallback}</>;
  return <>{children}</>;
}
