import "server-only";
import { prisma } from "@/server/db/client";
import { verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, setSessionActiveOrg } from "@/server/auth/session";
import { ApiError } from "@/server/api/envelope";
import { writeAuditLog } from "@/server/modules/audit/audit.service";
import type { AuthContext } from "@/server/auth/context";
import type { MeDto } from "@/shared/schemas/auth";

export async function login(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: input.email.toLowerCase(), deletedAt: null },
  });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new ApiError("AUTH_INVALID_CREDENTIALS");
  }
  if (user.status !== "active") throw new ApiError("AUTH_ACCOUNT_DISABLED");

  const firstMembership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "active", deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { tenantId: true },
  });

  await createSession({
    userId: user.id,
    activeOrgId: firstMembership?.tenantId ?? null,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  if (firstMembership) {
    void writeAuditLog({
      tenantId: firstMembership.tenantId,
      actorType: "user",
      actorId: user.id,
      action: "auth.login",
    });
  }
}

export async function logout(): Promise<void> {
  await destroySession();
}

export async function switchOrg(auth: AuthContext, orgId: string): Promise<void> {
  const membership = await prisma.membership.findFirst({
    where: { tenantId: orgId, userId: auth.userId, status: "active", deletedAt: null },
  });
  if (!membership) throw new ApiError("PERMISSION_DENIED", "你不是该组织的成员");
  await setSessionActiveOrg(auth.sessionId, orgId);
}

export async function getMe(auth: AuthContext): Promise<MeDto> {
  const memberships = await prisma.membership.findMany({
    where: { userId: auth.userId, status: "active", deletedAt: null },
    include: {
      organization: { select: { id: true, name: true } },
      role: { select: { key: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return {
    user: auth.user,
    org: auth.org,
    role_key: auth.roleKey,
    permissions: auth.permissions,
    memberships: memberships.map((m) => ({
      org_id: m.organization.id,
      org_name: m.organization.name,
      role_key: m.role.key,
      role_name: m.role.name,
    })),
  };
}
