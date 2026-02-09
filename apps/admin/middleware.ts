import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (process.env.ADMIN_DISABLE_AUTH_MIDDLEWARE === 'true') {
    return NextResponse.next();
  }

  const token = request.cookies.get('admin-token')?.value;

  // Allow login and locale routes
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/locale')) {
    return NextResponse.next();
  }

  // Check authentication - simple token presence check
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|locale).*)'],
};
