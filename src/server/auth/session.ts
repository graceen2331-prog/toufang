import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";
import { sessionSecurityConfig } from "@/server/config/env";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/shared/auth/session";

export { SESSION_COOKIE } from "@/shared/auth/session";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionRecord {
  id: string;
  userId: string;
  activeOrgId: string | null;
  expiresAt: Date;
  lastSeenAt: Date;
}

/** 创建会话并写入 httpOnly cookie */
export async function createSession(input: {
  userId: string;
  activeOrgId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const security = sessionSecurityConfig();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + security.absoluteTtlMs);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "id" = ${input.userId} FOR UPDATE
    `;
    await tx.session.deleteMany({
      where: {
        userId: input.userId,
        OR: [
          { expiresAt: { lte: now } },
          { lastSeenAt: { lte: new Date(now.getTime() - security.idleTtlMs) } },
        ],
      },
    });
    const sessionsToEvict = await tx.session.findMany({
      where: { userId: input.userId },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      skip: security.maxActiveSessions - 1,
      select: { id: true },
    });
    if (sessionsToEvict.length > 0) {
      await tx.session.deleteMany({ where: { id: { in: sessionsToEvict.map((item) => item.id) } } });
    }
    await tx.session.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(token),
        activeOrgId: input.activeOrgId,
        expiresAt,
        lastSeenAt: now,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
  });
  const cookieStore = await cookies();
  if (SESSION_COOKIE !== LEGACY_SESSION_COOKIE) cookieStore.delete(LEGACY_SESSION_COOKIE);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** 从 cookie 读取并校验会话；无效返回 null */
export async function getSession(): Promise<SessionRecord | null> {
  const security = sessionSecurityConfig();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      activeOrgId: true,
      expiresAt: true,
      lastSeenAt: true,
    },
  });
  if (!session) return null;
  const now = new Date();
  if (
    session.expiresAt <= now ||
    session.lastSeenAt <= new Date(now.getTime() - security.idleTtlMs)
  ) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }
  if (session.lastSeenAt <= new Date(now.getTime() - security.touchIntervalMs)) {
    await prisma.session.updateMany({
      where: { id: session.id, lastSeenAt: session.lastSeenAt },
      data: { lastSeenAt: now },
    });
    session.lastSeenAt = now;
  }
  return session;
}

/** 切换会话的活跃组织 */
export async function setSessionActiveOrg(sessionId: string, orgId: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { activeOrgId: orgId } });
}

/** 销毁会话并清除 cookie */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
  if (SESSION_COOKIE !== LEGACY_SESSION_COOKIE) cookieStore.delete(LEGACY_SESSION_COOKIE);
}
