import "server-only";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { ApiError } from "@/server/api/envelope";

export function parseTrustedClientIp(headers: Headers, headerName: string | undefined): string | null {
  const normalizedHeader = headerName?.trim().toLowerCase();
  if (!normalizedHeader) return null;
  const raw = headers.get(normalizedHeader)?.trim();
  if (!raw || raw.includes(",") || isIP(raw) === 0) return null;
  return raw.toLowerCase();
}

export function resolveLoginClientIp(
  req: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const ip = parseTrustedClientIp(req.headers, env.AUTH_CLIENT_IP_HEADER);
  if (ip) return ip;
  if (env.NODE_ENV === "production") {
    throw new ApiError(
      "AUTH_RATE_LIMIT_UNAVAILABLE",
      "无法确认登录请求来源，请稍后重试",
      undefined,
      { "Retry-After": "30" },
    );
  }
  return null;
}
