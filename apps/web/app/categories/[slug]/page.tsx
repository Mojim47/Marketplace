import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, GlassCard, SectionTitle } from '@/components/ui';
import { getCategoryBySlug } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export default async function CategoryDetailPage({ params }: { params: { slug: string } }) {
  const category = await getCategoryBySlug(params.slug);

  if (!category) {
    notFound();
  }

  const level2Groups = category.children;

  return (
    <Container className="py-12">
      <header className="rounded-3xl border border-white/10 bg-slate-900/60 p-8">
        <p className="text-xs text-slate-300">دسته بندی L{category.level}</p>
        <SectionTitle className="mt-2 text-3xl text-white">{category.name}</SectionTitle>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">{category.description ?? 'بدون توضیح'}</p>
      </header>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        {level2Groups.map((group) => (
          <GlassCard key={group.id} className="rounded-3xl p-6">
            <h2 className="section-title text-xl text-white">{group.name}</h2>
            <p className="mt-2 text-xs text-slate-400">L{group.level} • {group.slug}</p>
            <p className="mt-3 text-sm text-slate-300">{group.description ?? 'بدون توضیح'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.children.slice(0, 4).map((child) => (
                <span key={child.id} className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300">
                  {child.name}
                </span>
              ))}
              {group.children.length === 0 ? (
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">بدون L3</span>
              ) : null}
            </div>
            <Link
              href={`/categories?group=${encodeURIComponent(category.slug)}&level=${encodeURIComponent(group.slug)}`}
              className="mt-5 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-white/25"
            >
              مشاهده محصولات این زیرگروه
            </Link>
          </GlassCard>
        ))}
      </section>

      <div className="mt-8">
        <Link
          href="/categories"
          className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-white/25"
        >
          بازگشت به دسته بندی ها
        </Link>
      </div>
    </Container>
  );
}
