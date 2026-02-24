'use client';

export default function ProfileError() {
  return (
    <div className="min-h-screen px-6 py-16">
      <div className="glass-card mx-auto max-w-3xl rounded-3xl p-10 text-center">
        <h1 className="section-title text-2xl text-slate-900">خطا در پروفایل</h1>
        <p className="mt-3 text-sm text-slate-600">
          مشکلی در بارگذاری پروفایل رخ داد. لطفاً دوباره تلاش کنید.
        </p>
      </div>
    </div>
  );
}
