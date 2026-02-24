import Link from 'next/link';
import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function EmptyStatePage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="State" title="حالت خالی" subtitle="برای جلوگیری از سردرگمی کاربر در نبود داده." />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-700">
        داده‌ای برای نمایش وجود ندارد. <Link className="text-orange-600 hover:text-orange-700" href="/categories">شروع خرید</Link>
      </GlassCard>
    </Container>
  );
}
