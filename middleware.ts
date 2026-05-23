import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 中间件：保护需要登录的路由。
 *
 * EARS-1: 未登录用户访问创作类功能时跳转登录页，且不得创建 userId 或 R2 作品对象前缀。
 * EARS-3: 未登录用户调用需认证的创作或作品类 API 时返回 HTTP 401。
 *
 * 公开路由（无需登录）：
 *   /                    — 首页
 *   /auth/*              — 登录/注册/错误
 *   /api/auth/*          — NextAuth API
 *   /marketing           — 营销页（可选）
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径：直接放行
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // 检查 session
  // 注意：这里使用简单的 cookie 检查，生产环境应调用 auth() 获取真实 session
  // 由于 NextAuth 的 session cookie 名称取决于配置，使用前缀匹配
  const sessionCookie =
    request.cookies.get("next-auth.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token");

  if (!sessionCookie) {
    // 未登录：重定向到登录页（API 路由返回 401）
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const callbackUrl = encodeURIComponent(request.url);
    const loginUrl = new URL("/auth/sign-in", request.url);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl.toString());
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};