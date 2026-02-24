import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma-server';
import {
  STORY_SESSION_COOKIE,
  STORY_SESSION_MAX_AGE,
  signStoryMediaPayload,
} from '@/lib/story-runtime';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_TTL_SECONDS = 45;
const MEDIA_URL_TTL_SECONDS = 15 * 60;
const ANALYTICS_WINDOW_DAYS = 14;

type StoryManifestItem = {
  storyId: string;
  vendorId: string;
  vendorName: string;
  title: string;
  caption?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  expiresAt: string;
  signedMediaUrl: string;
  rankScore: number;
  freshnessScore: number;
  ctr: number;
  conversionRate: number;
  palette: {
    bg: string;
    accent: string;
    text: string;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function getPalette(seed: string) {
  const digest = createHash('sha256').update(seed).digest();
  const h1 = digest[0] % 360;
  const h2 = digest[1] % 360;
  const h3 = digest[2] % 360;

  return {
    bg: `hsl(${h1} 72% 94%)`,
    accent: `hsl(${h2} 74% 46%)`,
    text: `hsl(${h3} 38% 18%)`,
  };
}

function isInRollout(sessionId: string, vendorId: string, rolloutPercent: number): boolean {
  if (rolloutPercent >= 100) {
    return true;
  }
  if (rolloutPercent <= 0) {
    return false;
  }
  const digest = createHash('sha256').update(`${sessionId}:${vendorId}`).digest();
  const bucket = ((digest[0] << 8) | digest[1]) % 100;
  return bucket < rolloutPercent;
}

function computeFreshnessScore(createdAt: Date, expiresAt: Date): number {
  const now = Date.now();
  const created = createdAt.getTime();
  const expires = expiresAt.getTime();
  const duration = Math.max(1, expires - created);
  const remaining = Math.max(0, expires - now);
  return clamp(remaining / duration, 0, 1);
}

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get('vendor');
  const limit = clamp(Number(request.nextUrl.searchParams.get('limit') || 12), 3, 36);
  const sessionCookie = request.cookies.get(STORY_SESSION_COOKIE)?.value;
  const sessionId = sessionCookie || randomUUID();
  const now = new Date();
  const since = new Date(now.getTime() - ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const stories = await prisma.vendorStory.findMany({
    where: {
      is_active: true,
      expires_at: { gt: now },
      ...(vendorId ? { vendor_id: vendorId } : {}),
      vendor: {
        stories_enabled: true,
      },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          story_rollout_percent: true,
        },
      },
    },
    orderBy: [{ created_at: 'desc' }],
    take: 120,
  });

  const rolledOutStories = stories.filter((story) =>
    isInRollout(sessionId, story.vendor.id, story.vendor.story_rollout_percent)
  );

  const storyIds = rolledOutStories.map((story) => story.id);
  const analyticsRows =
    storyIds.length === 0
      ? []
      : await prisma.vendorStoryEvent.findMany({
          where: {
            story_id: { in: storyIds },
            created_at: { gte: since },
            event_type: { in: ['impression', 'click', 'conversion'] },
          },
          select: {
            story_id: true,
            event_type: true,
          },
        });

  const analytics = new Map<string, { impression: number; click: number; conversion: number }>();
  for (const row of analyticsRows) {
    const bucket = analytics.get(row.story_id) ?? { impression: 0, click: 0, conversion: 0 };
    if (row.event_type === 'impression') {
      bucket.impression += 1;
    } else if (row.event_type === 'click') {
      bucket.click += 1;
    } else if (row.event_type === 'conversion') {
      bucket.conversion += 1;
    }
    analytics.set(row.story_id, bucket);
  }

  const items: StoryManifestItem[] = rolledOutStories
    .map((story) => {
      const counts = analytics.get(story.id) ?? { impression: 0, click: 0, conversion: 0 };
      const ctr = counts.impression > 0 ? counts.click / counts.impression : 0;
      const conversionRate = counts.click > 0 ? counts.conversion / counts.click : 0;
      const freshnessScore = computeFreshnessScore(story.created_at, story.expires_at);
      const rankScore = freshnessScore * (1 + ctr * 2.2 + conversionRate * 4.5);

      const exp = Math.floor(Date.now() / 1000) + MEDIA_URL_TTL_SECONDS;
      const sig = signStoryMediaPayload(story.media_url, exp);
      const signedMediaUrl = `/api/stories/media?u=${encodeURIComponent(story.media_url)}&exp=${exp}&sig=${sig}`;

      return {
        storyId: story.id,
        vendorId: story.vendor.id,
        vendorName: story.vendor.name,
        title: story.title,
        caption: story.caption,
        ctaLabel: story.cta_label,
        ctaUrl: story.cta_url,
        expiresAt: story.expires_at.toISOString(),
        signedMediaUrl,
        rankScore: round(rankScore),
        freshnessScore: round(freshnessScore),
        ctr: round(ctr),
        conversionRate: round(conversionRate),
        palette: getPalette(`${story.media_url}:${story.title}:${story.vendor.id}`),
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, limit);

  const response = NextResponse.json({
    generatedAt: new Date().toISOString(),
    ttlSeconds: DEFAULT_TTL_SECONDS,
    sessionId,
    items,
  });

  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${DEFAULT_TTL_SECONDS}, stale-while-revalidate=120`
  );

  if (!sessionCookie) {
    response.cookies.set({
      name: STORY_SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: STORY_SESSION_MAX_AGE,
    });
  }

  return response;
}
