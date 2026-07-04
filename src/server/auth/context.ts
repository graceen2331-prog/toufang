import "server-only";
import { prisma } from "@/server/db/client";
import { getSession } from "@/server/auth/session";
import { ApiError } from "@/server/api/envelope";
import { roleHasPermission, type Permission } from "@/shared/constants/permissions";

export interface AuthContext {
  sessionId: string;
  userId: string;
  user: { id: string; email: string; name: string };
  orgId: string;
  org: { id: string; name: string; slug: string };
  roleKey: string;
  permissions: string[];
  /** 品牌级数据范围；空数组 = 不限 */
  brandScope: string[];
}

/**
 * 解析当前请求的认证上下文（session → user → 活跃组织 membership → 权限）。
 * 未登录 / 会话过期 / 用户被禁用 / 无组织成员身份时抛 ApiError。
 */
export async function getAuthContext(): Promise<AuthContext> {
  const session = await getSession();
  if (!session) throw new ApiError("AUTH_REQUIRED");

  const user = await prisma.user.findFirst({
    where: { id: session.userId, deletedAt: null },
    select: { id: true, email: true, name: true, status: true },
  });
  if (!user) throw new ApiError("AUTH_SESSION_EXPIRED");
  if (user.status !== "active") throw new ApiError("AUTH_ACCOUNT_DISABLED");

  if (!session.activeOrgId) throw new ApiError("TENANT_REQUIRED", "请先选择组织");

  const membership = await prisma.membership.findFirst({
    where: {
      tenantId: session.activeOrgId,
      userId: user.id,
      status: "active",
      deletedAt: null,
    },
    include: {
      role: { select: { key: true, permissions: true } },
      organization: { select: { id: true, name: true, slug: true, status: true } },
    },
  });
  if (!membership) throw new ApiError("TENANT_REQUIRED", "你不是该组织的成员");
  if (membership.organization.status !== "active") {
    throw new ApiError("PERMISSION_DENIED", "组织已被停用");
  }

  return {
    sessionId: session.id,
    userId: user.id,
    user: { id: user.id, email: user.email, name: user.name },
    orgId: membership.organization.id,
    org: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
    },
    roleKey: membership.role.key,
    permissions: membership.role.permissions as string[],
    brandScope: (membership.brandScope as string[]) ?? [],
  };
}

export function requirePermission(auth: AuthContext, permission: Permission): void {
  if (!roleHasPermission(auth.permissions, permission)) {
    throw new ApiError("PERMISSION_DENIED", `缺少权限：${permission}`);
  }
}
