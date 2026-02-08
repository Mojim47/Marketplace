import { Container, GlassCard, SectionTitle } from "@/components/ui";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <Container className="py-16">
        <GlassCard className="rounded-3xl p-8">
          <p className="text-xs text-slate-300">Privacy & Trust</p>
          <SectionTitle className="mt-2 text-3xl text-white">حریم خصوصی کاربران</SectionTitle>
          <p className="mt-3 text-sm text-slate-300">
            تعهد ما حفظ امنیت داده‌های شما و شفافیت کامل در استفاده از اطلاعات است.
          </p>
        </GlassCard>

        <section className="mt-8 space-y-6">
          {[
            {
              title: "جمع‌آوری داده‌ها",
              body: "اطلاعات لازم برای بهبود تجربه خرید، مانند تاریخچه سفارش و تنظیمات کاربری جمع‌آوری می‌شود.",
            },
            {
              title: "امنیت و نگهداری",
              body: "داده‌ها با استانداردهای امنیتی ذخیره شده و دسترسی به آن‌ها محدود و ثبت‌شده است.",
            },
            {
              title: "پردازش هوشمند",
              body: "تحلیل‌های هوش مصنوعی تا حد امکان روی دستگاه کاربر اجرا می‌شود تا حریم خصوصی حفظ شود.",
            },
            {
              title: "حقوق کاربران",
              body: "در هر زمان می‌توانید درخواست مشاهده، ویرایش یا حذف داده‌های شخصی خود را ثبت کنید.",
            },
          ].map((item) => (
            <GlassCard key={item.title} className="rounded-2xl p-6">
              <SectionTitle className="text-xl text-white">{item.title}</SectionTitle>
              <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
            </GlassCard>
          ))}
        </section>
      </Container>
    </div>
  );
}
