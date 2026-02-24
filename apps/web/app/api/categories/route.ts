import { getCategoryBySlug, listCategoryTree } from '@/lib/categories';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const group = request.nextUrl.searchParams.get('group');
    const level = request.nextUrl.searchParams.get('level');
    const q = request.nextUrl.searchParams.get('q');
    const slug = request.nextUrl.searchParams.get('slug');

    if (slug) {
      const category = await getCategoryBySlug(slug);
      if (!category) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ category });
    }

    const tree = await listCategoryTree({ group, level, q });

    return NextResponse.json({
      tree,
      meta: {
        count: tree.length,
        filters: { group, level, q },
      },
    });
  } catch {
    return NextResponse.json({ error: 'category_fetch_failed' }, { status: 503 });
  }
}
