import { Link } from 'react-router-dom'

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

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link
          to="/preview"
          className="flex items-center justify-center rounded bg-scarlet text-white text-sm font-semibold px-4 py-2.5 hover:bg-scarlet-dark transition-colors"
        >
          Preview JTS R2 Form
        </Link>
      </div>

      <p className="text-xs text-neutral-400 max-w-sm text-center">
        Phase 1 in progress — read-only form preview. Auth, responses, and PDF export coming next.
      </p>
    </main>
  )
}
