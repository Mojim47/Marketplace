import { Container, GlassCard, SectionTitle } from "@/components/ui";

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Container className="py-16">
        <GlassCard className="rounded-3xl p-8">
          <p className="text-xs text-slate-300">Terms of Service</p>
          <SectionTitle className="mt-2 text-3xl text-white">شرایط و مقررات استفاده</SectionTitle>
          <p className="mt-3 text-sm text-slate-300">
            استفاده از خدمات NextGen Marketplace به معنی پذیرش کامل این شرایط است.
          </p>
        </GlassCard>

        <section className="mt-8 space-y-6">
          {[
            {
              title: "حساب کاربری",
              body: "کاربر مسئول حفظ امنیت حساب خود بوده و هرگونه فعالیت با حساب ثبت‌شده به عهده اوست.",
            },
            {
              title: "محتوا و مالکیت",
              body: "تمامی محتوا، طراحی و داده‌ها متعلق به NextGen Marketplace است و استفاده غیرمجاز ممنوع است.",
            },
            {
              title: "پرداخت و بازگشت",
              body: "پرداخت‌ها طبق قوانین پرداخت آنلاین انجام شده و بازگشت وجه بر اساس سیاست‌های مشخص صورت می‌گیرد.",
            },
            {
              title: "مسئولیت‌ها",
              body: "خدمات مطابق استاندارد ارائه می‌شوند، اما مسئولیت نهایی انتخاب و خرید کالا با کاربر است.",
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
