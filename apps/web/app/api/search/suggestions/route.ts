import { randomUUID } from 'node:crypto';
import { aimarketTaxonomy, flattenTaxonomy } from '@/lib/aimarket-taxonomy';
import { prisma } from '@/lib/prisma-server';
import { isStrictProdPolicyEnabled } from '@/lib/runtime-policy';
import { NextRequest, NextResponse } from 'next/server';

type SuggestionItem = {
  type: 'history' | 'trending' | 'category';
  value: string;
  label: string;
  score: number;
  categorySlug?: string | null;
};

type SuggestionResponse = {
  query: string;
  categoryScope: string | null;
  suggestions: SuggestionItem[];
};

const VISITOR_COOKIE = 'aimarket_vid';
const prismaSuggestion = prisma as any;

function normalizeQuery(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createCategorySuggestion(query: string, categoryScope: string | null): SuggestionItem[] {
  const q = normalizeQuery(query);
  if (!q) {
    return [];
  }

  const scopedRoot = categoryScope
    ? aimarketTaxonomy.find((node) => node.slug === categoryScope)
    : null;
  const source = scopedRoot ? flattenTaxonomy([scopedRoot]) : flattenTaxonomy();

  return source
    .filter((item) => {
      const hay = `${item.name} ${item.slug} ${item.description}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 6)
    .map((item, index) => ({
      type: 'category' as const,
      value: item.slug,
      label: item.name,
      score: 70 - index,
      categorySlug: item.slug,
    }));
}

async function getHistorySuggestions(
  visitorId: string,
  query: string,
  categoryScope: string | null
) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [] as SuggestionItem[];
  }

  try {
    const history: Array<{ query: string; category?: { slug?: string | null } | null }> =
      await prismaSuggestion.searchSuggestionHistory.findMany({
        where: {
          visitor_id: visitorId,
          normalized_query: {
            startsWith: normalized,
            mode: 'insensitive',
          },
          ...(categoryScope ? { category: { slug: categoryScope } } : {}),
        },
        orderBy: { searched_at: 'desc' },
        take: 5,
        select: {
          query: true,
          category: { select: { slug: true } },
        },
      });

    return history.map(
      (item: { query: string; category?: { slug?: string | null } | null }, index: number) => ({
        type: 'history' as const,
        value: item.query,
        label: item.query,
        score: 100 - index,
        categorySlug: item.category?.slug ?? null,
      })
    );
  } catch {
    if (isStrictProdPolicyEnabled()) {
      throw new Error('suggestion_history_unavailable_strict_mode');
    }
    return [] as SuggestionItem[];
  }
}

async function getTrendingSuggestions(query: string, categoryScope: string | null) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [] as SuggestionItem[];
  }

  try {
    const trends: Array<{
      query: string;
      hits: number;
      category?: { slug?: string | null } | null;
    }> = await prismaSuggestion.searchSuggestionTrend.findMany({
      where: {
        normalized_query: {
          contains: normalized,
          mode: 'insensitive',
        },
        ...(categoryScope ? { category: { slug: categoryScope } } : {}),
      },
      orderBy: [{ hits: 'desc' }, { last_seen_at: 'desc' }],
      take: 6,
      select: {
        query: true,
        hits: true,
        category: { select: { slug: true } },
      },
    });

    if (trends.length > 0) {
      return trends.map(
        (item: { query: string; hits: number; category?: { slug?: string | null } | null }) => ({
          type: 'trending' as const,
          value: item.query,
          label: item.query,
          score: Math.min(95, 40 + item.hits),
          categorySlug: item.category?.slug ?? null,
        })
      );
    }
  } catch {
    if (isStrictProdPolicyEnabled()) {
      throw new Error('suggestion_trending_unavailable_strict_mode');
    }
    // fallback below for non-strict environments
  }

  const fallback = flattenTaxonomy(
    categoryScope
      ? aimarketTaxonomy.filter((item) => item.slug === categoryScope)
      : aimarketTaxonomy
  )
    .filter((item) => item.level >= 2)
    .map((item) => item.name)
    .filter((item) => item.toLowerCase().includes(normalized))
    .slice(0, 6);

  return fallback.map((label, index) => ({
    type: 'trending' as const,
    value: label,
    label,
    score: 80 - index,
    categorySlug: categoryScope,
  }));
}

function mergeUnique(items: SuggestionItem[], limit: number): SuggestionItem[] {
  const seen = new Set<string>();
  const out: SuggestionItem[] = [];

  for (const item of items.sort((a, b) => b.score - a.score)) {
    const key = `${item.type}:${item.value}:${item.categorySlug ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
    if (out.length >= limit) {
      break;
    }
  }

  return out;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '10');
  const categoryScope = request.nextUrl.searchParams.get('category');

  const normalized = normalizeQuery(query);
  if (normalized.length < 2) {
    return NextResponse.json<SuggestionResponse>({
      query,
      categoryScope,
      suggestions: [],
    });
  }

  const visitorFromCookie = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = visitorFromCookie || randomUUID();

  let history: SuggestionItem[] = [];
  let trending: SuggestionItem[] = [];
  try {
    [history, trending] = await Promise.all([
      getHistorySuggestions(visitorId, normalized, categoryScope),
      getTrendingSuggestions(normalized, categoryScope),
    ]);
  } catch {
    return NextResponse.json(
      {
        query,
        categoryScope,
        suggestions: [],
        error: 'suggestions_unavailable_strict_mode',
      },
      { status: 503 }
    );
  }
  const categories = createCategorySuggestion(normalized, categoryScope);

  const suggestions = mergeUnique(
    [...history, ...trending, ...categories],
    Math.min(20, Math.max(5, limit))
  );

  const response = NextResponse.json<SuggestionResponse>({
    query,
    categoryScope,
    suggestions,
  });

  if (!visitorFromCookie) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: visitorId,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    query?: string;
    categorySlug?: string | null;
  } | null;

  const query = normalizeQuery(body?.query ?? '');
  const categorySlug = body?.categorySlug ?? null;

  if (!query) {
    return NextResponse.json({ ok: false, reason: 'query_required' }, { status: 400 });
  }

  const visitorFromCookie = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = visitorFromCookie || randomUUID();

  try {
    const category = categorySlug
      ? await prismaSuggestion.category.findUnique({
          where: { slug: categorySlug },
          select: { id: true },
        })
      : null;

    await prismaSuggestion.searchSuggestionHistory.create({
      data: {
        visitor_id: visitorId,
        query,
        normalized_query: query,
        category_id: category?.id ?? null,
      },
    });

    const trendRow = await prismaSuggestion.searchSuggestionTrend.findFirst({
      where: {
        normalized_query: query,
        category_id: category?.id ?? null,
      },
      select: { id: true },
    });

    if (trendRow) {
      await prismaSuggestion.searchSuggestionTrend.update({
        where: { id: trendRow.id },
        data: {
          query,
          hits: { increment: 1 },
          last_seen_at: new Date(),
        },
      });
    } else {
      await prismaSuggestion.searchSuggestionTrend.create({
        data: {
          query,
          normalized_query: query,
          category_id: category?.id ?? null,
          hits: 1,
          last_seen_at: new Date(),
        },
      });
    }
  } catch {
    return NextResponse.json({ ok: false, reason: 'persistence_unavailable' }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });

  if (!visitorFromCookie) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: visitorId,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
