"use client";

import { useMe } from "@/features/auth/queries";
import { useHydrated } from "@/lib/use-hydrated";
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
  const hydrated = useHydrated();
  const { data: me } = useMe();
  // 权限未知时保持关闭，确保 SSR 与客户端水合首帧一致且不泄露受限操作。
  if (!hydrated || !me) return null;
  if (!roleHasPermission(me.permissions, permission)) return <>{fallback}</>;
  return <>{children}</>;
}
