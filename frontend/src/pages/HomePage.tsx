export function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Role 2 Readiness Assessment
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Unofficial — not endorsed by USMC, Navy, DHA, or JTS
        </p>
      </div>

      <div className="rounded border border-neutral-200 bg-white p-6 text-sm text-neutral-700 max-w-md w-full">
        <p className="font-semibold text-neutral-900 mb-2">Phase 1 scaffolding complete.</p>
        <ul className="list-disc list-inside space-y-1 text-neutral-600">
          <li>FastAPI backend running on :8000</li>
          <li>Content routes serving JTS R2 framework</li>
          <li>CUI banners persistent top + bottom</li>
          <li>Read-only preview page next</li>
        </ul>
      </div>
    </main>
  )
}
