import { NextRequest, NextResponse } from "next/server";

const isAdminRoute = (pathname: string) => pathname.startsWith("/admin");
const isAuthRoute = (pathname: string) => pathname.startsWith("/auth");
const isApiRoute = (pathname: string) => pathname.startsWith("/api");

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy for API routes (they handle auth internally)
  if (isApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Check authentication for admin and login routes
  if (isAdminRoute(pathname) || isAuthRoute(pathname)) {
    // const token = request.cookies.get('auth-token')?.value;
    // const payload = token ? await AuthService.verifyToken(token) : null;
    // const isAuth = !!payload;
    const isAuth = true;

    if (isAdminRoute(pathname) && !isAuth) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    if (isAuthRoute(pathname) && isAuth) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - favicon.png (favicon file)
     * - assets (static assets)
     * - robots.txt (robots file)
     * - sitemap.xml (sitemap file)
     * - sitemap-*.xml (sitemap files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|favicon.png|assets|robots.txt|sitemap.xml|sitemap-).*)",
  ],
};
