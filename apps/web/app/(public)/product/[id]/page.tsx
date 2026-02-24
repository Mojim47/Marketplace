import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Container, GlassCard, Pill, SectionTitle } from '@/components/ui';
import { CATALOG_PRODUCTS, findProductById } from '@/lib/catalog-data';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = findProductById(id);
  if (!product) {
    notFound();
  }

  const related = CATALOG_PRODUCTS.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const money = new Intl.NumberFormat('fa-IR');

  return (
    <Container className="py-10">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="relative h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <Image src={product.image} alt={product.name} fill className="object-cover" priority />
          </div>
        </GlassCard>

        <GlassCard className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <Pill>{product.badge}</Pill>
            <Pill>{product.category}</Pill>
          </div>
          <SectionTitle className="mt-4 text-3xl text-slate-900">{product.name}</SectionTitle>
          <p className="mt-3 text-sm leading-7 text-slate-600">{product.summary}</p>

          <div className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">فروشنده: {product.seller}</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">امتیاز: {product.rating.toFixed(1)}</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">حداقل سفارش: {product.minOrderQty} عدد</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">موجودی: {product.stock} عدد</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">زمان ارسال: {product.eta}</div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-slate-600">قیمت نهایی</p>
            <p className="text-2xl font-semibold text-slate-900">{money.format(product.priceIrr)} تومان</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/checkout" className="btn btn-primary inline-flex items-center justify-center">
              خرید فوری
            </Link>
            <Button variant="outline">درخواست پیش‌فاکتور</Button>
            <Link href={`/categories?group=${encodeURIComponent(product.category)}`} className="btn btn-ghost inline-flex items-center justify-center">
              محصولات مشابه
            </Link>
          </div>
        </GlassCard>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle className="text-2xl text-slate-900">محصولات مرتبط</SectionTitle>
          <Link href="/categories" className="text-sm text-orange-600 hover:text-orange-700">مشاهده همه</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {related.map((item) => (
            <Link key={item.id} href={`/product/${item.slug}`} className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5">
              <div className="relative h-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="(min-width: 1024px) 20vw, 45vw" />
              </div>
              <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-900">{item.name}</p>
              <p className="mt-1 text-[11px] text-slate-500">{money.format(item.priceIrr)} تومان</p>
            </Link>
          ))}
        </div>
      </section>
    </Container>
  );
}

