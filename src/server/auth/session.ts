import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";

export const SESSION_COOKIE = "tf_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionRecord {
  id: string;
  userId: string;
  activeOrgId: string | null;
  expiresAt: Date;
}

/** 创建会话并写入 httpOnly cookie */
export async function createSession(input: {
  userId: string;
  activeOrgId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(token),
      activeOrgId: input.activeOrgId,
      expiresAt,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  const cookieStore = await cookies();
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
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, activeOrgId: true, expiresAt: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
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
    cookieStore.delete(SESSION_COOKIE);
  }
}
