// ═══════════════════════════════════════════════════════════════════════════
// Vendor Portal - Home Page
// ═══════════════════════════════════════════════════════════════════════════

export default function VendorPortalHome() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            پنل فروشندگان NextGen
          </h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-600 mb-4">
                خوش آمدید به پنل فروشندگان
              </h2>
              <p className="text-gray-500">
                پنل مدیریت فروشندگان در حال توسعه است
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}