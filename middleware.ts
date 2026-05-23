import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

/**
 * 中间件：Auth 校验 + i18n + IP 限流
 *
 * EARS-1: 未登录用户访问创作类功能时跳转登录页 + callbackUrl
 * EARS-2: API 速率超限返回明确英文错误
 * EARS-3: 未登录用户调用需认证的 API 时返回 HTTP 401
 * EARS-4: 限流拒绝时展示非阻塞英文错误（通过 errorKey 映射）
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ========== 限流检查（/api/*） ==========
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    const { allowed, resetAt } = checkRateLimit(ip);

    if (!allowed) {
      return rateLimitExceededResponse(resetAt);
    }
  }

  // ========== 公开路径放行 ==========
  const isPublicPath =
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/^\/[a-z]{2}\/auth\//);

  if (isPublicPath) {
    // 对非 locale 路径的首页应用默认 locale
    if (pathname === "/") {
      const locale = request.cookies.get("NEXT_LOCALE")?.value ?? "zh";
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
    return NextResponse.next();
  }

  // ========== Session 检查 ==========
  const sessionToken =
    request.cookies.get("next-auth.session-token")?.value ??
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!sessionToken) {
    // 未登录：API 路由返回 401，页面路由重定向
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } },
        { status: 401 }
      );
    }

    // 页面重定向到登录页，带 callbackUrl
    const callbackUrl = encodeURIComponent(request.url);
    const locale = request.cookies.get("NEXT_LOCALE")?.value ?? "zh";
    const loginUrl = new URL(`/${locale}/auth/sign-in`, request.url);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl.toString());
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
