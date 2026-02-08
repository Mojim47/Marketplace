export default function AdminLoginError() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <div className="admin-card w-full rounded-3xl p-8 text-center">
          <h1 className="admin-title text-2xl text-white">خطا در ورود</h1>
          <p className="mt-3 text-sm text-slate-300">
            مشکلی در بارگذاری پنل ورود رخ داد. لطفاً دوباره تلاش کنید.
          </p>
        </div>
      </div>
    </div>
  );
}
