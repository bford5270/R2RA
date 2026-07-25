import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { TrTasking } from '../types/assessment'
import type { TrFramework } from '../types/tr'
import type { UserOut } from '../types/user'

/**
 * S3T tasking management (lead / admin only): list current evaluator
 * taskings, assign new ones by picking wickets (individually, by chapter,
 * or by MET), reopen returned taskings, remove taskings.
 */
export function TrTaskingPanel({
  assessmentId,
  framework,
  taskings,
  onChanged,
}: {
  assessmentId: string
  framework: TrFramework
  taskings: TrTasking[]
  onChanged: (next: TrTasking[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleReopen(t: TrTasking) {
    setBusyId(t.id)
    try {
      const updated = await api.reopenTrTasking(t.id)
      onChanged(taskings.map(x => (x.id === updated.id ? updated : x)))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(t: TrTasking) {
    if (!window.confirm(`Remove ${t.display_name}'s tasking (${t.event_codes.length} wickets)?`)) return
    setBusyId(t.id)
    try {
      await api.deleteTrTasking(assessmentId, t.id)
      onChanged(taskings.filter(x => x.id !== t.id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="border-t border-neutral-300 mt-2 pt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-600 py-1"
      >
        <span>Evaluator Taskings{taskings.length > 0 ? ` (${taskings.length})` : ''}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="space-y-1.5 pb-1">
          {taskings.map(t => (
            <div key={t.id} className="rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="flex-1 min-w-0 text-[11px] font-semibold text-neutral-700 truncate">
                  {t.display_name}
                </span>
                <span
                  className="text-[8px] font-bold uppercase tracking-wide rounded px-1 py-0.5"
                  style={
                    t.status === 'returned'
                      ? { background: 'rgba(107,127,79,0.22)', color: 'var(--signal-green)' }
                      : { background: 'rgba(91,122,139,0.22)', color: 'var(--signal-blue)' }
                  }
                >
                  {t.status === 'returned' ? 'Returned' : 'Assigned'}
                </span>
              </div>
              <p className="text-[9px] text-neutral-500 mt-0.5">
                {t.event_codes.length} wicket{t.event_codes.length === 1 ? '' : 's'}
                {t.mets.length > 0 && ` · ${t.mets.join(', ')}`}
              </p>
              <div className="flex gap-2 mt-1">
                {t.status === 'returned' && (
                  <button
                    onClick={() => handleReopen(t)}
                    disabled={busyId === t.id}
                    className="text-[9px] font-semibold text-neutral-500 hover:text-neutral-700 underline disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
                <button
                  onClick={() => handleRemove(t)}
                  disabled={busyId === t.id}
                  className="text-[9px] font-semibold text-neutral-400 hover:text-red-600 underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowAssign(true)}
            className="w-full text-[10px] font-semibold border border-dashed border-neutral-400 text-neutral-500 hover:text-neutral-700 hover:border-neutral-500 rounded px-2 py-1.5"
          >
            + Assign tasking
          </button>
        </div>
      )}

      {showAssign && (
        <AssignTaskingModal
          assessmentId={assessmentId}
          framework={framework}
          existing={taskings}
          onClose={() => setShowAssign(false)}
          onSaved={t => {
            const rest = taskings.filter(x => x.user_id !== t.user_id)
            onChanged([...rest, t])
            setShowAssign(false)
          }}
        />
      )}
    </div>
  )
}

function AssignTaskingModal({
  assessmentId,
  framework,
  existing,
  onClose,
  onSaved,
}: {
  assessmentId: string
  framework: TrFramework
  existing: TrTasking[]
  onClose: () => void
  onSaved: (t: TrTasking) => void
}) {
  const [users, setUsers] = useState<UserOut[] | null>(null)
  const [userId, setUserId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedMets, setSelectedMets] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listUsers().then(us => {
      setUsers(us.filter(u => u.global_role !== 'pending'))
    }).catch(() => setUsers([]))
  }, [])

  // Editing an existing tasking pre-fills it
  function handlePickUser(id: string) {
    setUserId(id)
    const prior = existing.find(t => t.user_id === id)
    if (prior) {
      setSelected(new Set(prior.event_codes))
      setSelectedMets(new Set(prior.mets))
      setNote(prior.note ?? '')
    }
  }

  // All MET ids present in the framework, with their wicket coverage
  const metIndex = useMemo(() => {
    const idx = new Map<string, string[]>()
    for (const w of framework.wickets) {
      for (const m of w.mets_extracted ?? []) {
        const list = idx.get(m.id) ?? []
        list.push(w.event_code)
        idx.set(m.id, list)
      }
    }
    return idx
  }, [framework])

  function toggleMet(metId: string) {
    const codes = metIndex.get(metId) ?? []
    setSelected(prev => {
      const next = new Set(prev)
      const adding = !selectedMets.has(metId)
      for (const c of codes) {
        if (adding) next.add(c)
        else next.delete(c)
      }
      return next
    })
    setSelectedMets(prev => {
      const next = new Set(prev)
      if (next.has(metId)) next.delete(metId)
      else next.add(metId)
      return next
    })
  }

  function toggleWicket(code: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleChapter(chNum: number) {
    const codes = framework.wickets.filter(w => w.chapter === chNum).map(w => w.event_code)
    const allIn = codes.every(c => selected.has(c))
    setSelected(prev => {
      const next = new Set(prev)
      for (const c of codes) {
        if (allIn) next.delete(c)
        else next.add(c)
      }
      return next
    })
  }

  async function handleSave() {
    if (!userId || selected.size === 0) return
    setSaving(true)
    setError(null)
    try {
      const t = await api.upsertTrTasking(assessmentId, userId, {
        event_codes: [...selected],
        mets: [...selectedMets],
        note: note.trim() || null,
      })
      onSaved(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tasking')
    } finally {
      setSaving(false)
    }
  }

  const q = filter.trim().toLowerCase()
  const chapters = framework.chapters.filter(ch =>
    framework.wickets.some(w => w.chapter === ch.number)
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6">
      <div className="bg-neutral-50 w-full sm:max-w-lg sm:rounded-lg shadow-2 flex flex-col max-h-[92vh] sm:max-h-[80vh]">
        <div className="px-5 py-3.5 border-b border-neutral-300 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-display text-sm font-bold text-neutral-900">Assign tasking</h3>
            <p className="text-[10px] text-neutral-500">Pick an evaluator and their PECLs / METs</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Evaluator */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
              Evaluator
            </label>
            <select
              value={userId}
              onChange={e => handlePickUser(e.target.value)}
              className="w-full rounded border border-neutral-400 px-3 py-2 text-sm bg-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
            >
              <option value="">Select evaluator…</option>
              {(users ?? []).map(u => (
                <option key={u.id} value={u.id}>
                  {u.display_name}{existing.some(t => t.user_id === u.id) ? ' (already tasked — edits)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* MET quick-select */}
          {metIndex.size > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Quick-select by MET
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[...metIndex.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([metId, codes]) => (
                  <button
                    key={metId}
                    type="button"
                    onClick={() => toggleMet(metId)}
                    className="text-[10px] font-mono rounded-full border px-2.5 py-1 transition-colors"
                    style={
                      selectedMets.has(metId)
                        ? { background: 'rgba(91,122,139,0.22)', color: 'var(--signal-blue)', borderColor: 'var(--signal-blue)' }
                        : { borderColor: 'var(--border-1)', color: 'var(--ink-2)' }
                    }
                  >
                    {metId} · {codes.length}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Wicket picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Wickets ({selected.size} selected)
              </label>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => { setSelected(new Set()); setSelectedMets(new Set()) }}
                  className="text-[10px] text-neutral-400 hover:text-neutral-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by code or title…"
              className="w-full rounded border border-neutral-300 px-3 py-1.5 text-xs bg-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-500/40 mb-2"
            />
            <div className="border border-neutral-300 rounded max-h-64 overflow-y-auto divide-y divide-neutral-200">
              {chapters.map(ch => {
                const wickets = framework.wickets.filter(w =>
                  w.chapter === ch.number &&
                  (!q || w.event_code.toLowerCase().includes(q) || w.title.toLowerCase().includes(q))
                )
                if (wickets.length === 0) return null
                const chCodes = framework.wickets.filter(w => w.chapter === ch.number).map(w => w.event_code)
                const allIn = chCodes.every(c => selected.has(c))
                return (
                  <div key={ch.number}>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-200 sticky top-0">
                      <button
                        type="button"
                        onClick={() => toggleChapter(ch.number)}
                        className="text-[9px] font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-700"
                      >
                        {allIn ? '☑' : '☐'} Ch. {ch.number} — {ch.title}
                      </button>
                    </div>
                    {wickets.map(w => (
                      <label
                        key={w.event_code}
                        className="flex items-start gap-2 px-2.5 py-1.5 hover:bg-neutral-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(w.event_code)}
                          onChange={() => toggleWicket(w.event_code)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="text-[10px] font-mono font-semibold text-neutral-700">{w.event_code}</span>
                          <span className="block text-[10px] text-neutral-500 leading-snug">{w.title}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
              Instructions to evaluator (optional)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-xs bg-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              placeholder="e.g. Evaluate during the MASCAL serial on day 2"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-300 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-700 px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !userId || selected.size === 0}
            className="rounded bg-scarlet text-white text-xs font-bold px-5 py-2 hover:bg-scarlet-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Assigning…' : `Assign ${selected.size} wicket${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Evaluator-facing banner: tasking progress + Return to S3T.
 */
export function MyTaskingBanner({
  tasking,
  scoredCount,
  onReturned,
}: {
  tasking: TrTasking
  scoredCount: number
  onReturned: (t: TrTasking) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = tasking.event_codes.length
  const complete = scoredCount >= total
  const returned = tasking.status === 'returned'

  async function handleReturn() {
    if (!window.confirm('Return your tasking to S3T? You will not be able to change scores unless the lead reopens it.')) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api.returnTrTasking(tasking.id)
      onReturned(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return tasking')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="mb-5 rounded-lg border p-4"
      style={
        returned
          ? { background: 'rgba(107,127,79,0.12)', borderColor: 'var(--signal-green)' }
          : { background: 'rgba(91,122,139,0.10)', borderColor: 'rgba(91,122,139,0.40)' }
      }
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: returned ? 'var(--signal-green)' : 'var(--signal-blue)' }}>
            {returned ? '✓ Returned to S3T' : 'Your tasking'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
            {scoredCount} of {total} wicket{total === 1 ? '' : 's'} scored
            {tasking.mets.length > 0 && <> · {tasking.mets.join(', ')}</>}
          </p>
          {tasking.note && (
            <p className="text-[11px] mt-1 italic" style={{ color: 'var(--ink-2)' }}>
              S3T: “{tasking.note}”
            </p>
          )}
        </div>
        {!returned && (
          <button
            onClick={handleReturn}
            disabled={busy || !complete}
            title={complete ? 'Return your completed tasking' : 'Score all assigned wickets first'}
            className="rounded px-4 py-2.5 text-xs font-bold border-2 transition-colors disabled:opacity-40 min-h-[44px]"
            style={{ borderColor: 'var(--signal-green)', color: 'var(--signal-green)', background: 'rgba(107,127,79,0.10)' }}
          >
            {busy ? 'Returning…' : 'Return to S3T →'}
          </button>
        )}
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2, rgba(0,0,0,0.08))' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${total ? Math.round((scoredCount / total) * 100) : 0}%`,
            background: returned || complete ? 'var(--signal-green)' : 'var(--signal-blue)',
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
