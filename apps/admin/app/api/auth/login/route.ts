import { NextResponse } from 'next/server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const AUTH_COOKIE_NAME = 'admin-token';
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function isMockAllowed() {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  return process.env.ALLOW_AUTH_MOCK === 'true';
}

async function parseLoginPayload(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    return parsed.data;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
}

async function handleRealAuth(payload: z.infer<typeof loginSchema>) {
  const endpoint = process.env.ADMIN_AUTH_ENDPOINT;
  if (!endpoint) {
    return NextResponse.json({ error: 'missing_admin_auth_endpoint' }, { status: 500 });
  }

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await upstream.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const token = (data.access_token ?? data.token) as string | undefined;
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
  return response;
}

function handleMockAuth(payload: z.infer<typeof loginSchema>) {
  const response = NextResponse.json({
    ok: true,
    mode: 'mock',
    user: { email: payload.email },
  });
  const safeEmail = encodeURIComponent(payload.email);
  response.cookies.set(AUTH_COOKIE_NAME, `mock-${safeEmail}`, AUTH_COOKIE_OPTIONS);
  return response;
}

export async function POST(request: Request) {
  const parsed = await parseLoginPayload(request);
  if (parsed instanceof NextResponse) {
    return parsed;
  }
  const payload = parsed;

  const mode = (process.env.AUTH_MODE || 'mock').toLowerCase();

  if (process.env.NODE_ENV === 'production' && mode !== 'real' && !isMockAllowed()) {
    return NextResponse.json({ error: 'auth_mode_must_be_real' }, { status: 500 });
  }

  if (mode === 'real') {
    return handleRealAuth(payload);
  }

  if (!isMockAllowed()) {
    return NextResponse.json({ error: 'mock_auth_disabled' }, { status: 403 });
  }

  return handleMockAuth(payload);
}
