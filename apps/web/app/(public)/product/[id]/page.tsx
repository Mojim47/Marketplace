import { ProductActionPanel } from '@/components/ProductActionPanel';
import { ProductMediaGallery } from '@/components/ProductMediaGallery';
import { ProductRelatedRail } from '@/components/ProductRelatedRail';
import { Container, GlassCard, Pill, SectionTitle } from '@/components/ui';
import { CATALOG_PRODUCTS, findProductById } from '@/lib/catalog-data';
import { CheckCircle2, MessageSquareMore, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = findProductById(id);
  if (!product) {
    notFound();
  }

  const related = CATALOG_PRODUCTS.filter(
    (item) => item.category === product.category && item.id !== product.id
  ).slice(0, 4);

  const galleryItems = [product.image, ...related.map((item) => item.image)]
    .filter((src, index, all) => all.indexOf(src) === index)
    .slice(0, 5)
    .map((src, index) => ({
      src,
      alt: index === 0 ? product.name : `${product.name} - نمای ${index + 1}`,
    }));

  const money = new Intl.NumberFormat('fa-IR');

  return (
    <Container className="py-10">
      <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <GlassCard className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
          <ProductMediaGallery items={galleryItems} />
        </GlassCard>

        <GlassCard className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <Pill>{product.badge}</Pill>
            <Pill>{product.category}</Pill>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
              فروشنده طلایی از ۱۴۰۰
            </span>
          </div>

          <SectionTitle className="mt-4 text-3xl text-slate-900">{product.name}</SectionTitle>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              امتیاز {product.rating.toFixed(1)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              موجودی {product.stock} عدد
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              فروشنده: {product.seller}
            </span>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">{product.summary}</p>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-slate-600">قیمت نهایی</p>
            <p className="text-3xl font-semibold text-slate-900">{money.format(product.priceIrr)} تومان</p>
            <p className="mt-1 text-xs text-emerald-700">{product.eta}</p>
          </div>

          <ProductActionPanel
            productId={product.id}
            productSlug={product.slug}
            category={product.category}
          />

          <div className="mt-6 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <ShieldCheck size={14} className="text-emerald-600" />
              ۷ روز ضمانت بازگشت
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Truck size={14} className="text-emerald-600" />
              ارسال امروز از شهر X
            </div>
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <PackageCheck size={14} className="text-emerald-600" />
              اصالت و سلامت فیزیکی
            </div>
          </div>
        </GlassCard>
      </div>

      <section className="mt-10 space-y-6">
        <div className="flex gap-2 overflow-x-auto text-xs">
          <a href="#specs" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
            مشخصات فنی
          </a>
          <a href="#description" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
            توضیحات
          </a>
          <a href="#reviews" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
            نظرات
          </a>
          <a href="#qa" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
            پرسش و پاسخ
          </a>
        </div>

        <div id="specs" className="rounded-3xl border border-slate-200 bg-white p-6">
          <SectionTitle className="text-2xl text-slate-900">مشخصات فنی</SectionTitle>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">دسته: {product.category}</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">حداقل سفارش: {product.minOrderQty} عدد</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">امتیاز کیفیت: {product.rating.toFixed(1)} / 5</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">زمان ارسال: {product.eta}</div>
          </div>
        </div>

        <div id="description" className="rounded-3xl border border-slate-200 bg-white p-6">
          <SectionTitle className="text-2xl text-slate-900">توضیحات</SectionTitle>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            این محصول برای تجربه خرید حرفه‌ای طراحی شده است: مسیر تصمیم‌گیری شفاف، اطلاعات قابل اتکا و
            سازگار با استفاده روزمره. تمرکز صفحه روی Above-the-fold واضح و اقدام سریع کاربر است.
          </p>
        </div>

        <div id="reviews" className="rounded-3xl border border-slate-200 bg-white p-6">
          <SectionTitle className="text-2xl text-slate-900">نظرات کاربران</SectionTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">تجربه عالی در تحویل</p>
              <p className="mt-2">ارسال سریع بود و کیفیت محصول با توضیحات کاملا مطابقت داشت.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">پشتیبانی پاسخگو</p>
              <p className="mt-2">پاسخ پشتیبانی کمتر از ۱۰ دقیقه انجام شد و مشکل سریعا رفع شد.</p>
            </div>
          </div>
        </div>

        <div id="qa" className="rounded-3xl border border-slate-200 bg-white p-6">
          <SectionTitle className="text-2xl text-slate-900">پرسش و پاسخ</SectionTitle>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="inline-flex items-center gap-1 font-semibold text-slate-900">
                <MessageSquareMore size={15} /> آیا این محصول گارانتی دارد؟
              </p>
              <p className="mt-2">بله، شامل ۷ روز ضمانت بازگشت و پشتیبانی فنی فروشنده است.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="inline-flex items-center gap-1 font-semibold text-slate-900">
                <CheckCircle2 size={15} /> امکان خرید عمده وجود دارد؟
              </p>
              <p className="mt-2">بله، برای سفارش عمده می‌توانید درخواست پیش‌فاکتور ثبت کنید.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle className="text-2xl text-slate-900">محصولات مرتبط</SectionTitle>
          <Link href="/categories" className="text-sm text-orange-600 hover:text-orange-700">
            مشاهده همه
          </Link>
        </div>

        <ProductRelatedRail products={related} />
      </section>
    </Container>
  );
}
