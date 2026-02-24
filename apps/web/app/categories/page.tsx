import Link from 'next/link';
import Image from 'next/image';
import { Container, GlassCard, Pill, SectionTitle } from '@/components/ui';
import { CATALOG_PRODUCTS } from '@/lib/catalog-data';
import { listCategoryTree } from '@/lib/categories';

type CategoriesPageProps = {
  searchParams?: Promise<{
    q?: string;
    group?: string;
    level?: string;
  }>;
};

export const dynamic = 'force-dynamic';

function flatten(nodes: Awaited<ReturnType<typeof listCategoryTree>>): Awaited<ReturnType<typeof listCategoryTree>> {
  const out: Awaited<ReturnType<typeof listCategoryTree>> = [];

  const walk = (items: typeof nodes) => {
    for (const item of items) {
      out.push(item);
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return out;
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const resolved = (await searchParams) ?? {};
  const q = resolved.q?.trim() ?? '';
  const group = resolved.group?.trim() ?? '';
  const level = resolved.level?.trim() ?? '';

  const tree = await listCategoryTree({
    q: q || null,
    group: group || null,
    level: level || null,
  });

  const cards = flatten(tree).filter((item) => item.level === 1 || item.level === 2);
  const products = CATALOG_PRODUCTS.filter((item) => (group ? item.category === group : true)).slice(0, 12);
  const money = new Intl.NumberFormat('fa-IR');

  return (
    <Container className="py-12">
      <header className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Pill>Connected to Live DB</Pill>
          <Pill>L1/L2/L3 Taxonomy</Pill>
          <Pill>Production Category Tree</Pill>
        </div>

        <SectionTitle className="text-3xl text-white">مرکز دسته‌بندی محصولات</SectionTitle>
        <h1 className="sr-only">دسته‌بندی‌های AIMarket</h1>

        <p className="max-w-2xl text-sm text-slate-300">
          داده‌ها مستقیم از دیتابیس خوانده می‌شوند. scope جست‌وجو (`group`, `level`, `q`) روی همین route اعمال می‌شود.
        </p>
      </header>

      <section className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-slate-900/50 p-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          فیلتر گروه: <span className="text-white">{group || 'همه'}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          فیلتر سطح: <span className="text-white">{level || 'همه'}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          عبارت: <span className="text-white">{q || 'بدون جست‌وجو'}</span>
        </div>
      </section>

      <div className="mt-6 text-xs text-slate-300">
        {cards.length.toLocaleString('fa-IR')} دسته مطابق فیلتر پیدا شد.
      </div>

      <section className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((category) => (
          <GlassCard key={category.id} className="rounded-3xl p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-title text-xl text-white">{category.name}</h2>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-slate-300">L{category.level}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">slug: {category.slug}</p>
            <p className="mt-4 text-sm text-slate-300">{category.description ?? 'بدون توضیح'}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {category.children.slice(0, 3).map((child) => (
                <span key={child.id} className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-200">
                  {child.name}
                </span>
              ))}
              {category.children.length === 0 ? (
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">بدون زیرگروه</span>
              ) : null}
            </div>

            <Link
              href={`/categories/${category.slug}`}
              className="mt-6 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-white/25"
            >
              مشاهده جزئیات
            </Link>
          </GlassCard>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle className="text-2xl text-slate-900">محصولات این دسته</SectionTitle>
          <span className="text-xs text-slate-600">{products.length.toLocaleString('fa-IR')} محصول</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <Link key={product.id} href={`/product/${product.slug}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5">
              <div className="relative h-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <Image src={product.image} alt={product.name} fill className="object-cover" sizes="(min-width:1024px) 20vw, 40vw" />
              </div>
              <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-900">{product.name}</p>
              <p className="mt-1 text-[11px] text-slate-500">{product.seller}</p>
              <p className="mt-2 text-xs font-semibold text-slate-800">{money.format(product.priceIrr)} تومان</p>
            </Link>
          ))}
        </div>
      </section>
    </Container>
  );
}
