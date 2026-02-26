import { AUTH_COOKIE_NAME } from '@/lib/auth-config';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type JwtPayload = {
  sub?: string;
  email?: string;
  mobile?: string;
  role?: string;
  exp?: number;
};

function parseJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

function isMockMode() {
  return (
    (process.env.AUTH_MODE || '').toLowerCase() === 'mock' || process.env.ALLOW_AUTH_MOCK === 'true'
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const payload = parseJwt(token);
  if (!payload && isMockMode()) {
    const userCookie = cookieStore.get('auth_user')?.value;
    let user: Record<string, unknown> = {
      id: 'mock-user-1',
      email: 'user@example.com',
      role: 'USER',
      firstName: 'Mock',
      lastName: 'User',
      mobile: '09120000000',
    };
    if (userCookie) {
      try {
        user = JSON.parse(userCookie) as Record<string, unknown>;
      } catch {
        // ignore malformed user cookie in mock mode
      }
    }
    return NextResponse.json({ authenticated: true, user });
  }

  if (!payload || (payload.exp && Date.now() >= payload.exp * 1000)) {
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  let user: Record<string, unknown> = {
    id: payload.sub ?? '',
    email: payload.email ?? null,
    mobile: payload.mobile ?? null,
    role: payload.role ?? 'USER',
  };

  const userCookie = cookieStore.get('auth_user')?.value;
  if (userCookie) {
    try {
      user = JSON.parse(userCookie) as Record<string, unknown>;
    } catch {
      // ignore malformed user cookie
    }
  }

  return NextResponse.json({ authenticated: true, user });
}
