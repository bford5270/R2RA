import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment, MyTrTasking } from '../types/assessment'
import { MISSION_TYPE_LABELS } from '../types/assessment'
import { useAuth } from '../lib/auth'
import { useExercise } from '../lib/exercise'
import { StatusChip } from '../components/StatusChip'
import { InstallPrompt } from '../components/InstallPrompt'

export function HomePage() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const { exercise, clearExercise } = useExercise()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [taskings, setTaskings] = useState<MyTrTasking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.global_role === 'admin'
  const isPending = user?.global_role === 'pending'

  useEffect(() => {
    if (isPending) {
      // Unapproved accounts can't read assessments — don't hit the API.
      setLoading(false)
      return
    }
    api.listAssessments()
      .then(setAssessments)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
    api.myTrTaskings().then(setTaskings).catch(() => {/* non-blocking */})
  }, [isPending])

  const visibleAssessments = isAdmin
    ? assessments
    : assessments.filter(a => a.exercise_id === exercise?.id)

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mt-8 mb-6">
        <div>
          {/* Logo mark + wordmark */}
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-7 w-7" style={{ color: 'var(--ink-1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink-1)' }}>
                ROLE 2
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-3)', marginTop: 1 }}>
                READINESS ASSESSMENT
              </span>
            </div>
          </div>
          <p className="text-xs text-neutral-600 mt-0.5">Unofficial — not endorsed by USMC, Navy, DHA, or JTS</p>
          {exercise && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border" style={{ background: 'rgba(91,122,139,0.15)', color: 'var(--signal-blue)', borderColor: 'rgba(91,122,139,0.30)' }}>
              <span className="font-semibold">{exercise.name}</span>
              <Link
                to="/exercise-select"
                onClick={() => { if (!isAdmin) clearExercise() }}
                className="text-blue-500 hover:text-blue-700 underline"
              >
                change
              </Link>
            </div>
          )}
          {isAdmin && !exercise && (
            <Link
              to="/exercise-select"
              className="mt-2 inline-block text-xs text-neutral-400 hover:text-neutral-600 underline"
            >
              Select exercise context
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isPending && (
            <Link
              to="/reports/readiness"
              className="text-xs text-neutral-500 hover:text-neutral-700"
            >
              Readiness
            </Link>
          )}
          <Link
            to="/preview"
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            Form preview
          </Link>
          {user?.global_role === 'admin' && (
            <>
              <Link
                to="/admin/users"
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Users
              </Link>
              <Link
                to="/admin/crosswalk"
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Crosswalk
              </Link>
            </>
          )}
          <Link
            to="/profile"
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            {user?.display_name ?? 'Account'}
          </Link>
          <button
            onClick={logout}
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            Sign out
          </button>
        </div>
      </div>

      <InstallPrompt />

      {isPending && (
        <div
          className="mb-6 rounded-lg border p-5"
          style={{ background: 'rgba(201,154,46,0.12)', borderColor: 'rgba(201,154,46,0.35)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--signal-amber)' }}>
            Account pending approval
          </p>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            Welcome, {user?.display_name}. Your account request has been received.
            An administrator must approve you and assign a role before you can
            participate in assessments. In the meantime you can explore the
            assessment framework:
          </p>
          <Link
            to="/preview"
            className="mt-3 inline-block rounded px-4 py-2 text-xs font-bold"
            style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
          >
            Browse the JTS Role 2 form →
          </Link>
        </div>
      )}

      {!isPending && (
      <>
      {/* Your tasking — evaluator fast path to their assigned PECLs/METs */}
      {taskings.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="font-display text-sm font-semibold text-neutral-700 uppercase tracking-widest">Your Tasking</h2>
          {taskings.map(t => {
            const total = t.event_codes.length
            const done = t.status === 'returned'
            return (
              <Link
                key={t.id}
                to={`/assessments/${t.assessment_id}/tr`}
                className="block rounded-lg border p-4 transition-colors hover:shadow-1"
                style={
                  done
                    ? { background: 'rgba(107,127,79,0.10)', borderColor: 'rgba(107,127,79,0.40)' }
                    : { background: 'rgba(91,122,139,0.10)', borderColor: 'rgba(91,122,139,0.40)' }
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900 truncate">
                      {t.unit_name}
                      {t.exercise_name && <span className="font-normal text-neutral-500"> · {t.exercise_name}</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-2)' }}>
                      {done
                        ? `✓ Returned to S3T ${t.returned_at ? new Date(t.returned_at).toLocaleDateString() : ''}`
                        : `${t.scored_count} of ${total} wickets scored${t.mets.length ? ` · ${t.mets.join(', ')}` : ''}`}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs font-bold"
                    style={{ color: done ? 'var(--signal-green)' : 'var(--signal-blue)' }}
                  >
                    {done ? 'View →' : 'Continue →'}
                  </span>
                </div>
                {!done && (
                  <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${total ? Math.round((t.scored_count / total) * 100) : 0}%`,
                        background: t.scored_count >= total ? 'var(--signal-green)' : 'var(--signal-blue)',
                      }}
                    />
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-sm font-semibold text-neutral-700 uppercase tracking-widest">Assessments</h2>
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

      {!loading && !error && visibleAssessments.length === 0 && (
        <div className="border border-dashed border-neutral-300 rounded p-8 text-center">
          <p className="text-sm text-neutral-500">
            {exercise && !isAdmin
              ? `No assessments for ${exercise.name} yet. Use "+ New assessment" to get started.`
              : 'No assessments yet. Use "+ New assessment" above to get started.'}
          </p>
        </div>
      )}

      {visibleAssessments.length > 0 && (
        <div className="divide-y divide-neutral-100 border border-neutral-400 rounded">
          {visibleAssessments.map(a => (
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
              <StatusChip status={a.status} />
            </Link>
          ))}
        </div>
      )}
      </>
      )}
    </main>
  )
}
