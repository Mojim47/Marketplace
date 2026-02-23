import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getApiBaseUrl } from '@/lib/auth-config';

const allowedPatterns = [
  /^cart(?:\/|$)/,
  /^checkout(?:\/|$)/,
  /^products(?:\/|$)/,
  /^v1\/orders(?:\/|$)/,
  /^auth\/sms(?:\/|$)/,
  /^payment(?:\/|$)/,
];

function isAllowed(path: string) {
  return allowedPatterns.some((pattern) => pattern.test(path));
}

function isMockMode() {
  return (process.env.AUTH_MODE || '').toLowerCase() === 'mock' || process.env.ALLOW_AUTH_MOCK === 'true';
}

function getMockResponse(path: string, method: string) {
  if (method === 'GET' && path === 'cart') {
    return NextResponse.json({
      items: [
        {
          productId: 'p1',
          productName: 'Galaxy Ultra 5G',
          productSku: 'GALAXY-ULTRA-5G',
          quantity: 1,
          price: 45000000,
        },
      ],
      subtotal: 45000000,
      discount: 0,
      shippingCost: 0,
      taxAmount: 4050000,
      total: 49050000,
    });
  }

  if (method === 'GET' && path === 'products') {
    return NextResponse.json([
      { id: 'p1', name: 'Galaxy Ultra 5G', sku: 'GALAXY-ULTRA-5G', price: 45000000 },
      { id: 'p2', name: 'XPhone Pro Max', sku: 'XPHONE-PRO-MAX', price: 39000000 },
    ]);
  }

  if (method === 'GET' && path === 'v1/orders') {
    return NextResponse.json([
      {
        id: 'order-1',
        orderNumber: 'NX-2049',
        status: 'PAID',
        totalAmount: 49050000,
        createdAt: new Date('2026-02-20T10:00:00Z').toISOString(),
        items: [{ id: 'item-1' }],
      },
    ]);
  }

  if (method === 'POST' && path === 'checkout/init') {
    return NextResponse.json({ id: 'sess-1' });
  }

  if (method === 'PUT' && /^checkout\/[^/]+\/shipping$/.test(path)) {
    return NextResponse.json({ ok: true });
  }

  if (method === 'PUT' && /^checkout\/[^/]+\/payment$/.test(path)) {
    return NextResponse.json({ ok: true });
  }

  if (method === 'POST' && /^checkout\/[^/]+\/complete$/.test(path)) {
    return NextResponse.json({ orderId: 'order-123', orderNumber: 'ORD-123' });
  }

  if (method === 'POST' && path === 'payment/request') {
    return NextResponse.json({ ok: true });
  }

  return null;
}

async function forward(request: Request, path: string[]) {
  const joinedPath = path.join('/');
  if (!isAllowed(joinedPath)) {
    return NextResponse.json({ error: 'forbidden_path' }, { status: 403 });
  }

  const apiBase = getApiBaseUrl();
  const incoming = new URL(request.url);
  const upstreamUrl = `${apiBase}/${joinedPath}${incoming.search}`;

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const method = request.method.toUpperCase();
  if (isMockMode()) {
    const mockResponse = getMockResponse(joinedPath, method);
    if (mockResponse) {
      return mockResponse;
    }
  }

  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    });
  } catch {
    if (isMockMode()) {
      const fallback = getMockResponse(joinedPath, method);
      if (fallback) {
        return fallback;
      }
    }
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get('content-type') || 'application/json';
  responseHeaders.set('content-type', upstreamContentType);

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  if (upstream.status === 401) {
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set('auth_user', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return forward(request, params.path);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return forward(request, params.path);
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return forward(request, params.path);
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const params = await context.params;
  return forward(request, params.path);
}
