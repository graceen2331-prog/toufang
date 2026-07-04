import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/v1/auth/login", "/api/v1/auth/logout"];
const SESSION_COOKIE = "tf_session";

/**
 * 粗粒度访问控制：无 session cookie 的页面请求重定向到 /login。
 * 真正的会话校验、租户与权限检查在 createApiHandler / 服务端组件内完成。
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

  // 根路径有 session cookie 时进入工作台；登录页始终放行，避免 DB reset
  // 或会话过期后残留 cookie 造成 /dashboard <-> /login 循环。
  if (hasSession && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!hasSession) {
    // API 请求交给 handler 返回 401 信封；页面请求重定向
    if (pathname.startsWith("/api/")) return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
