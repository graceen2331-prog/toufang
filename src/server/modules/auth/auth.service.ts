import "server-only";
import { prisma } from "@/server/db/client";
import { verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, setSessionActiveOrg } from "@/server/auth/session";
import { ApiError } from "@/server/api/envelope";
import { writeAuditLog } from "@/server/modules/audit/audit.service";
import type { AuthContext } from "@/server/auth/context";
import type { MeDto } from "@/shared/schemas/auth";
import {
  beginLoginAttempt,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/server/auth/login-protection";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$amlqDI4RGskKhrEYpbcBRA$K/eslAHoitLdYfFDAFw53phwBRXTQu9Tx6QNIN2PFVw";

export async function login(input: {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const email = input.email.normalize("NFKC").trim().toLowerCase();
  const limiterInput = { email, clientIp: input.ip ?? null };
  await beginLoginAttempt(limiterInput);
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  const passwordValid = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, input.password);
  if (!user || !passwordValid || user.status !== "active") {
    await recordLoginFailure(limiterInput);
    throw new ApiError("AUTH_INVALID_CREDENTIALS");
  }
  await recordLoginSuccess(limiterInput);

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
