import "server-only";
import type { NextRequest } from "next/server";
import { ApiError } from "@/server/api/envelope";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizedOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/"
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function validateMutationOrigin(
  req: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!MUTATION_METHODS.has(req.method.toUpperCase())) return;
  const expected = normalizedOrigin(env.APP_ORIGIN ?? req.nextUrl.origin);
  const originHeader = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase() ?? null;

  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    throw new ApiError("PERMISSION_DENIED", "请求来源校验失败");
  }
  if (originHeader) {
    const actual = normalizedOrigin(originHeader);
    if (!actual || !expected || actual !== expected) {
      throw new ApiError("PERMISSION_DENIED", "请求来源校验失败");
    }
    return;
  }
  if (fetchSite === "same-origin") return;
  if (env.NODE_ENV === "production") {
    throw new ApiError("PERMISSION_DENIED", "请求缺少可信来源信息");
  }
}
