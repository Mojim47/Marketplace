import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE_NAME, getApiBaseUrl, type WebAuthResponse } from '@/lib/auth-config';

const loginSchema = z.object({
  mobile: z.string().regex(/^09\d{9}$/),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

function isMockMode() {
  return (process.env.AUTH_MODE || '').toLowerCase() === 'mock' || process.env.ALLOW_AUTH_MOCK === 'true';
}

function createMockAccessToken(mobile: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'mock-user-1',
      mobile,
      role: 'USER',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    })
  ).toString('base64url');
  return `${header}.${payload}.mock-signature`;
}

export async function POST(request: Request) {
  let payload: z.infer<typeof loginSchema>;

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (isMockMode()) {
    const demoUser = {
      id: 'mock-user-1',
      email: `${payload.mobile}@mobile.nextgen.local`,
      mobile: payload.mobile,
      role: 'USER',
      firstName: 'Mock',
      lastName: 'User',
    };
    const response = NextResponse.json({ ok: true, user: demoUser });
    response.cookies.set(AUTH_COOKIE_NAME, createMockAccessToken(payload.mobile), cookieOptions);
    response.cookies.set('refresh_token', 'mock-refresh-token', refreshCookieOptions);
    response.cookies.set('auth_user', JSON.stringify(demoUser), {
      ...cookieOptions,
      httpOnly: false,
    });
    return response;
  }

  const apiBase = getApiBaseUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'auth_upstream_unreachable' }, { status: 502 });
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await upstream.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.message ?? data.error ?? 'login_failed' },
      { status: upstream.status }
    );
  }

  const auth = data as unknown as WebAuthResponse;
  if (!auth.access_token || !auth.user) {
    return NextResponse.json({ error: 'invalid_auth_response' }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true, user: auth.user });
  response.cookies.set(AUTH_COOKIE_NAME, auth.access_token, cookieOptions);
  if (auth.refresh_token) {
    response.cookies.set('refresh_token', auth.refresh_token, refreshCookieOptions);
  }
  response.cookies.set('auth_user', JSON.stringify(auth.user), {
    ...cookieOptions,
    httpOnly: false,
  });

  return response;
}
