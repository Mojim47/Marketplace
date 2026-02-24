import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma-server';
import {
  STORY_ATTR_COOKIE,
  STORY_ATTR_MAX_AGE,
  STORY_SESSION_COOKIE,
  STORY_SESSION_MAX_AGE,
  decodeStoryAttribution,
  encodeStoryAttribution,
} from '@/lib/story-runtime';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type StoryEventType = 'impression' | 'click' | 'conversion';

type StoryEventPayload = {
  type?: StoryEventType;
  storyId?: string;
  vendorId?: string;
  sessionId?: string;
  traceId?: string;
  meta?: Record<string, unknown>;
};

function isStoryEventType(value: unknown): value is StoryEventType {
  return value === 'impression' || value === 'click' || value === 'conversion';
}

function sanitizeText(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, max);
}

function sanitizeMeta(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const json = JSON.stringify(value);
  if (json.length > 3000) {
    return undefined;
  }
  return JSON.parse(json) as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as StoryEventPayload | null;
  if (!payload || !isStoryEventType(payload.type)) {
    return NextResponse.json(
      { ok: false, message: 'Invalid story event payload' },
      { status: 400 }
    );
  }

  const incomingSession = sanitizeText(payload.sessionId, 80);
  const cookieSession = request.cookies.get(STORY_SESSION_COOKIE)?.value;
  const sessionId = incomingSession || cookieSession || randomUUID();

  let storyId = sanitizeText(payload.storyId, 80);
  let vendorId = sanitizeText(payload.vendorId, 80);
  const traceId = sanitizeText(payload.traceId, 120);
  const meta = sanitizeMeta(payload.meta);

  if (payload.type === 'conversion' && (!storyId || !vendorId)) {
    const attribution = decodeStoryAttribution(request.cookies.get(STORY_ATTR_COOKIE)?.value);
    if (attribution) {
      storyId = storyId || attribution.storyId;
      vendorId = vendorId || attribution.vendorId;
    }
  }

  if (!storyId) {
    if (payload.type === 'conversion') {
      const skippedResponse = NextResponse.json({ ok: true, skipped: 'no_story_attribution' });
      if (!cookieSession) {
        skippedResponse.cookies.set({
          name: STORY_SESSION_COOKIE,
          value: sessionId,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: STORY_SESSION_MAX_AGE,
        });
      }
      skippedResponse.headers.set('Cache-Control', 'no-store');
      return skippedResponse;
    }
    return NextResponse.json({ ok: false, message: 'storyId is required' }, { status: 400 });
  }

  const story = await prisma.vendorStory.findUnique({
    where: { id: storyId },
    select: { id: true, vendor_id: true },
  });

  if (!story) {
    if (payload.type === 'conversion') {
      return NextResponse.json({ ok: true, skipped: 'story_not_found' });
    }
    return NextResponse.json({ ok: false, message: 'Story not found' }, { status: 404 });
  }

  const effectiveVendorId = vendorId || story.vendor_id;

  if (payload.type === 'impression') {
    const seenSince = new Date(Date.now() - 10 * 60 * 1000);
    const previous = await prisma.vendorStoryEvent.findFirst({
      where: {
        story_id: story.id,
        session_id: sessionId,
        event_type: 'impression',
        created_at: { gte: seenSince },
      },
      select: { id: true },
    });
    if (previous) {
      const deduped = NextResponse.json({ ok: true, deduped: true });
      if (!cookieSession) {
        deduped.cookies.set({
          name: STORY_SESSION_COOKIE,
          value: sessionId,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: STORY_SESSION_MAX_AGE,
        });
      }
      deduped.headers.set('Cache-Control', 'no-store');
      return deduped;
    }
  }

  await prisma.vendorStoryEvent.create({
    data: {
      story_id: story.id,
      vendor_id: effectiveVendorId,
      event_type: payload.type,
      session_id: sessionId,
      trace_id: traceId || null,
      meta: meta || undefined,
    },
  });

  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'no-store');

  if (!cookieSession) {
    response.cookies.set({
      name: STORY_SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: STORY_SESSION_MAX_AGE,
    });
  }

  if (payload.type === 'click') {
    response.cookies.set({
      name: STORY_ATTR_COOKIE,
      value: encodeStoryAttribution({
        storyId: story.id,
        vendorId: effectiveVendorId,
        at: Date.now(),
      }),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: STORY_ATTR_MAX_AGE,
    });
  }

  if (payload.type === 'conversion') {
    response.cookies.set({
      name: STORY_ATTR_COOKIE,
      value: '',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}
