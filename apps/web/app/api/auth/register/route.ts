import { AUTH_COOKIE_NAME, type WebAuthResponse, getApiBaseUrl } from '@/lib/auth-config';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  password: z.string().min(8),
  mobile: z.string().regex(/^09\d{9}$/),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
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

export async function POST(request: Request) {
  let payload: z.infer<typeof registerSchema>;

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const normalizedPayload = {
    ...payload,
    email: `${payload.mobile}@mobile.nextgen.local`,
  };

  const apiBase = getApiBaseUrl();
  const upstream = await fetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(normalizedPayload),
    cache: 'no-store',
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await upstream.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.message ?? data.error ?? 'register_failed' },
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
