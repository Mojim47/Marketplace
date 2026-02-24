import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const protectedPrefixes = ['/cart', '/checkout', '/orders', '/profile'];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;
  if (accessToken) {
    return NextResponse.next();
  }

  console.warn(
    JSON.stringify({
      type: 'guard_blocked',
      guard: 'route_protection_guard',
      guardReason: 'missing_access_token',
      prev: 'S0_ANON',
      next: pathname.startsWith('/checkout') ? 'S6_CHECKOUT_INIT' : 'S5_CART_ACTIVE',
      reason: 'missing_access_token',
      path: pathname,
    })
  );

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/cart/:path*', '/checkout/:path*', '/orders/:path*', '/profile/:path*'],
};
