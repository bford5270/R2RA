import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment } from '../types/assessment'
import { MISSION_TYPE_LABELS } from '../types/assessment'
import { useAuth } from '../lib/auth'

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-neutral-100 text-neutral-600',
    in_progress: 'bg-blue-50 text-blue-700',
    ready_for_review: 'bg-yellow-50 text-yellow-700',
    certified: 'bg-green-50 text-green-700',
  }
  return map[status] ?? 'bg-neutral-100 text-neutral-600'
}

export function HomePage() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listAssessments()
      .then(setAssessments)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mt-8 mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Role 2 Readiness Assessment</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Unofficial — not endorsed by USMC, Navy, DHA, or JTS</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/preview"
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            Form preview
          </Link>
          {user?.global_role === 'admin' && (
            <Link
              to="/admin/users"
              className="text-xs text-neutral-500 hover:text-neutral-700"
            >
              Users
            </Link>
          )}
          <button
            onClick={logout}
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-neutral-700">Assessments</h2>
        <button
          onClick={() => navigate('/assessments/new')}
          className="rounded bg-scarlet text-white text-xs font-semibold px-3 py-1.5 hover:bg-scarlet-dark transition-colors"
        >
          + New assessment
        </button>
      </div>

      {loading && (
        <p className="text-sm text-neutral-400 py-8 text-center">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-red-600 py-4">{error}</p>
      )}

      {!loading && !error && assessments.length === 0 && (
        <div className="border border-dashed border-neutral-200 rounded p-8 text-center">
          <p className="text-sm text-neutral-500">No assessments yet.</p>
          <button
            onClick={() => navigate('/assessments/new')}
            className="mt-3 text-sm text-scarlet hover:text-scarlet-dark font-medium"
          >
            Create the first one →
          </button>
        </div>
      )}

      {assessments.length > 0 && (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded">
          {assessments.map(a => (
            <Link
              key={a.id}
              to={`/assessments/${a.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-900">{a.unit_name}</span>
                  <span className="text-xs text-neutral-400 font-mono">{a.unit_uic}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {MISSION_TYPE_LABELS[a.mission_type]} · {new Date(a.started_at).toLocaleDateString()}
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(a.status)}`}>
                {a.status.replace('_', ' ')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
