import { notFound } from "next/navigation";
import { ARViewer } from "@nextgen/ar";
import { getProduct } from "@nextgen/types";
import { Button, Container, GlassCard, Pill, SectionTitle } from "@/components/ui";

interface ProductPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: ProductPageProps) {
  return { title: `محصول ${params.id}` };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProduct(params.id);
  if (!product) return notFound();

  return (
    <Container className="space-y-8 py-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <Pill className="px-3 py-1">محصول ویژه</Pill>
            <span>کد محصول: {product.id}</span>
          </div>
          <SectionTitle className="text-3xl text-white lg:text-4xl">{product.name}</SectionTitle>
          <p className="text-sm leading-7 text-slate-300">{product.description}</p>
          <div className="flex flex-wrap gap-3">
            <Button>افزودن به سبد</Button>
            <Button variant="outline">افزودن به علاقه‌مندی</Button>
          </div>
        </div>

        <GlassCard className="w-full rounded-3xl p-6 lg:w-[420px]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>امتیاز 4.8 از 5</span>
            <span>موجودی: {product.inventory}</span>
          </div>
          <div className="mt-6 rounded-2xl bg-slate-900/60 p-4 text-center">
            <p className="text-2xl font-semibold text-white">
              {product.priceRial.toLocaleString("fa-IR")} ریال
            </p>
            <p className="mt-2 text-xs text-slate-400">ارسال ویژه برای تهران و کرج</p>
          </div>
        </GlassCard>
      </div>

      {product.arModelId ? (
        <GlassCard className="rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <SectionTitle className="text-2xl text-white">نمایش در فضای واقعی</SectionTitle>
            <span className="text-xs text-slate-300">WebXR Ready</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            مدل سه‌بعدی را مستقیماً در محیط خود مشاهده کنید و اندازه واقعی را بسنجید.
          </p>
          <div className="mt-6">
            <ARViewer modelId={product.arModelId} />
          </div>
        </GlassCard>
      ) : null}
    </Container>
  );
}
