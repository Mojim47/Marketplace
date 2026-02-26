import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function PricingPage() {
  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Pricing"
        title="پلن‌های قیمت‌گذاری"
        subtitle="مدل قیمت‌گذاری شفاف برای رشد مرحله‌ای محصول."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {['Starter', 'Growth', 'Enterprise'].map((plan) => (
          <GlassCard key={plan} className="rounded-3xl p-6 text-sm text-slate-700">
            {plan}
          </GlassCard>
        ))}
      </div>
    </Container>
  );
}
