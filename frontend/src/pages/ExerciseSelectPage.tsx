import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useExercise } from '../lib/exercise'
import { useAuth } from '../lib/auth'
import type { Exercise } from '../types/exercise'

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ExerciseSelectPage() {
  const { setExercise } = useExercise()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listExercises()
      .then(setExercises)
      .catch(() => setError('Failed to load exercises'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const ex = await api.createExercise({
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        location: location.trim() || null,
      })
      setExercise(ex)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create exercise')
    } finally {
      setCreating(false)
    }
  }

  const active = exercises.filter(e => e.status === 'active')
  const closed = exercises.filter(e => e.status === 'closed')

  return (
    <main className="min-h-screen bg-neutral-50 flex items-start justify-center p-6">
      <div className="w-full max-w-2xl mt-16">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Select Exercise</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Choose the training exercise you are currently evaluating.
            </p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Sign out
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-neutral-400">Loading exercises…</p>
        ) : (
          <>
            {/* Active exercises */}
            {active.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Active Exercises</h2>
                <div className="space-y-2">
                  {active.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => { setExercise(ex); navigate('/') }}
                      className="w-full text-left rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-scarlet hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-neutral-900 group-hover:text-scarlet">{ex.name}</p>
                        <span className="text-xs text-scarlet font-medium opacity-0 group-hover:opacity-100 transition-opacity">Select →</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {fmt(ex.start_date)} – {fmt(ex.end_date)}
                        {ex.location && <span className="ml-2">· {ex.location}</span>}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new */}
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full rounded-lg border-2 border-dashed border-neutral-300 px-4 py-4 text-sm text-neutral-500 hover:border-scarlet hover:text-scarlet transition-colors"
              >
                + Create new exercise
              </button>
            ) : (
              <form onSubmit={handleCreate} className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4">
                <h2 className="text-sm font-semibold text-neutral-800">New Exercise</h2>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Exercise Name *</label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Iron Fist 2026, MCCRE FY26-1"
                    className="w-full border border-neutral-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-scarlet"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">Start Date *</label>
                    <input
                      required
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-scarlet"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1">End Date *</label>
                    <input
                      required
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-neutral-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-scarlet"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Location</label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Camp Pendleton, CA"
                    className="w-full border border-neutral-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-scarlet"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-scarlet text-white rounded px-4 py-2 text-sm font-medium hover:bg-scarlet/90 disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create & Select'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-sm border border-neutral-200 rounded text-neutral-600 hover:border-neutral-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Closed exercises */}
            {closed.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Past Exercises</h2>
                <div className="space-y-1">
                  {closed.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => { setExercise(ex); navigate('/') }}
                      className="w-full text-left rounded border border-neutral-100 bg-white px-4 py-2.5 hover:border-neutral-300 transition-colors"
                    >
                      <p className="text-sm text-neutral-600">{ex.name}</p>
                      <p className="text-xs text-neutral-400">
                        {fmt(ex.start_date)} – {fmt(ex.end_date)}
                        {ex.location && <span className="ml-2">· {ex.location}</span>}
                        <span className="ml-2 text-neutral-300">· Closed</span>
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
