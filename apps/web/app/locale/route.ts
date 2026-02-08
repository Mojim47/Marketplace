import { NextResponse } from 'next/server';

function safeNext(value: string | null): string {
  if (!value) {
    return '/';
  }
  if (value.startsWith('/')) {
    return value;
  }
  return '/';
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') || 'fa';
  const nextPath = safeNext(url.searchParams.get('next'));

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set('NG_LOCALE', lang, {
    path: '/',
    sameSite: 'lax',
  });
  return response;
}
