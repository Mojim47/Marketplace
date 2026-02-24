import { AUTH_COOKIE_NAME, getApiBaseUrl } from '@/lib/auth-config';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const refreshCookie = 'refresh_token';

const authCookieOptions = {
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

export async function POST() {
  const cookieStore = await cookies();
  const currentRefreshToken = cookieStore.get(refreshCookie)?.value;

  if (!currentRefreshToken) {
    return NextResponse.json({ error: 'missing_refresh_token' }, { status: 401 });
  }

  const upstream = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: currentRefreshToken }),
    cache: 'no-store',
  });

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  if (!upstream.ok) {
    const response = NextResponse.json(
      { error: data.message ?? data.error ?? 'refresh_failed' },
      { status: upstream.status }
    );
    response.cookies.set(AUTH_COOKIE_NAME, '', { ...authCookieOptions, maxAge: 0 });
    response.cookies.set(refreshCookie, '', { ...refreshCookieOptions, maxAge: 0 });
    response.cookies.set('auth_user', '', {
      ...authCookieOptions,
      httpOnly: false,
      maxAge: 0,
    });
    return response;
  }

  const accessToken = typeof data.access_token === 'string' ? data.access_token : null;
  const nextRefreshToken =
    typeof data.refresh_token === 'string' && data.refresh_token.length > 0
      ? data.refresh_token
      : currentRefreshToken;

  if (!accessToken) {
    return NextResponse.json({ error: 'invalid_refresh_response' }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
  response.cookies.set(refreshCookie, nextRefreshToken, refreshCookieOptions);
  return response;
}
