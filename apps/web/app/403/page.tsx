import Link from 'next/link';
import { Container, GlassCard, PageHeader } from '@/components/ui';

export default function PermissionDeniedPage() {
  return (
    <Container className="py-12">
      <PageHeader eyebrow="Access Control" title="عدم دسترسی" subtitle="شما مجوز مشاهده این صفحه را ندارید." />
      <GlassCard className="mt-8 rounded-3xl p-6 text-sm text-slate-200">
        برای ادامه به صفحه اصلی برگردید: <Link className="text-cyan-300 hover:text-cyan-200" href="/">بازگشت</Link>
      </GlassCard>
    </Container>
  );
}
