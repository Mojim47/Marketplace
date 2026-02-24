import { verifyStoryMediaSignature } from '@/lib/story-runtime';
import { NextRequest, NextResponse } from 'next/server';

function resolveMediaTarget(rawUrl: string, origin: string): URL | null {
  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith('/')) {
    return new URL(rawUrl, origin);
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isAllowedHost(target: URL): boolean {
  const allowListRaw = process.env.STORY_MEDIA_ALLOWED_HOSTS;
  if (!allowListRaw) {
    return true;
  }
  const allowed = allowListRaw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    return true;
  }
  return allowed.includes(target.hostname.toLowerCase());
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('u') || '';
  const exp = Number(request.nextUrl.searchParams.get('exp'));
  const sig = request.nextUrl.searchParams.get('sig') || '';

  if (!rawUrl || !Number.isFinite(exp) || !sig) {
    return NextResponse.json(
      { ok: false, message: 'Invalid media signature payload' },
      { status: 400 }
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp < nowSec) {
    return NextResponse.json({ ok: false, message: 'Signed media URL expired' }, { status: 410 });
  }

  const valid = verifyStoryMediaSignature(rawUrl, exp, sig);
  if (!valid) {
    return NextResponse.json({ ok: false, message: 'Signature mismatch' }, { status: 403 });
  }

  const target = resolveMediaTarget(rawUrl, request.nextUrl.origin);
  if (!target) {
    return NextResponse.json({ ok: false, message: 'Unsupported media URL' }, { status: 400 });
  }

  if (!isAllowedHost(target)) {
    return NextResponse.json({ ok: false, message: 'Media host is not allowed' }, { status: 403 });
  }

  const response = NextResponse.redirect(target, 307);
  response.headers.set('Cache-Control', 'private, max-age=60');
  return response;
}
