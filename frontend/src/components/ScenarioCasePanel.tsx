import { useState } from 'react'
import { api, authHeaders } from '../lib/api'
import type {
  CaseJourneyEntry,
  CasePersonnel,
  CasePhase,
  LoFeedback,
  LoFeedbackUpsert,
  ScenarioCase,
} from '../types/assessment'

// Continuum-of-care phases, in canonical order
export const PHASE_META: { value: CasePhase; label: string }[] = [
  { value: 'poi', label: 'POI / Arrival' },
  { value: 'triage', label: 'Triage' },
  { value: 'trauma_bay', label: 'Trauma Bay' },
  { value: 'or', label: 'OR' },
  { value: 'postop', label: 'Post-op / Holding' },
  { value: 'evac', label: 'Evacuation' },
  { value: 'other', label: 'Other' },
]

export function phaseLabel(e: CaseJourneyEntry): string {
  if (e.phase === 'other' && e.phase_label) return e.phase_label
  return PHASE_META.find(p => p.value === e.phase)?.label ?? e.phase
}

const ROLE_SUGGESTIONS = [
  'Bed Team',
  'Surg Tech',
  'Provider',
  'Surgeon',
  'Anesthesia',
  'Nurse',
  'Corpsman',
  'Evaluator',
]

/**
 * Scenario cases panel (TrPage sidebar): the role2builder case(s) this
 * evaluation was based on. Optional uploads — JSON exports, PDFs, images.
 */
export function ScenarioCasePanel({
  assessmentId,
  cases,
  onChanged,
}: {
  assessmentId: string
  cases: ScenarioCase[]
  onChanged: (next: ScenarioCase[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [label, setLabel] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState<ScenarioCase | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !label.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await api.uploadCase(assessmentId, file, label.trim(), sourceRef.trim(), [])
      onChanged([created, ...cases])
      setLabel('')
      setSourceRef('')
      setFile(null)
      setShowUpload(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(c: ScenarioCase) {
    const res = await fetch(api.caseFileUrl(c.id), { headers: authHeaders() })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = c.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(c: ScenarioCase) {
    if (!window.confirm(`Delete case "${c.label}"?`)) return
    await api.deleteCase(assessmentId, c.id)
    onChanged(cases.filter(x => x.id !== c.id))
  }

  return (
    <div className="border-t border-neutral-300 mt-2 pt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-600 py-1"
      >
        <span>Scenario Cases{cases.length > 0 ? ` (${cases.length})` : ''}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="space-y-1.5 pb-1">
          <p className="text-[9px] text-neutral-400 leading-snug">
            role2builder case(s) this evaluation was based on. Optional.
          </p>
          {cases.map(c => (
            <div key={c.id} className="rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5">
              <button
                onClick={() => handleDownload(c)}
                className="text-[11px] font-semibold text-neutral-700 hover:text-scarlet text-left leading-snug"
              >
                📄 {c.label}
              </button>
              {c.source_ref && (
                <p className="text-[9px] font-mono text-neutral-400 truncate">{c.source_ref}</p>
              )}
              {c.journey.length > 0 && (
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--signal-blue)' }}>
                  {c.journey.map(e => phaseLabel(e)).join(' → ')}
                </p>
              )}
              <div className="flex items-center justify-between mt-0.5 gap-2">
                <p className="text-[9px] text-neutral-400 truncate">{c.filename}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setTracking(c)}
                    className="text-[9px] font-semibold underline"
                    style={{ color: 'var(--signal-blue)' }}
                  >
                    {c.journey.length > 0 || c.personnel.length > 0 ? 'Journey' : 'Track case'}
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-[9px] text-neutral-400 hover:text-red-600 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {showUpload ? (
            <form onSubmit={handleUpload} className="rounded border border-neutral-300 bg-neutral-100 p-2 space-y-1.5">
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Case label (required)"
                required
                className="w-full rounded border border-neutral-300 px-2 py-1 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              />
              <input
                type="text"
                value={sourceRef}
                onChange={e => setSourceRef(e.target.value)}
                placeholder="role2builder case ID / URL (optional)"
                className="w-full rounded border border-neutral-300 px-2 py-1 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              />
              <input
                type="file"
                accept=".json,.pdf,.txt,.png,.jpg,.jpeg,.webp,.gif,application/json,application/pdf"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                required
                className="w-full text-[10px] text-neutral-500"
              />
              {error && <p className="text-[10px] text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !file || !label.trim()}
                  className="flex-1 rounded bg-scarlet text-white text-[10px] font-bold px-2 py-1.5 disabled:opacity-40"
                >
                  {busy ? 'Uploading…' : 'Upload case'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUpload(false); setError(null) }}
                  className="text-[10px] text-neutral-400 hover:text-neutral-600 px-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full text-[10px] font-semibold border border-dashed border-neutral-400 text-neutral-500 hover:text-neutral-700 hover:border-neutral-500 rounded px-2 py-1.5"
            >
              + Attach case from role2builder
            </button>
          )}
        </div>
      )}

      {tracking && (
        <CaseJourneyModal
          assessmentId={assessmentId}
          scenarioCase={tracking}
          onClose={() => setTracking(null)}
          onSaved={updated => {
            onChanged(cases.map(x => (x.id === updated.id ? updated : x)))
            setTracking(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Continuum-of-care tracker for a scenario case: ordered phase entries
 * (POI → triage → trauma bay → OR → post-op → evac) with optional time,
 * notes, and the personnel involved at each phase (bed team, surg tech,
 * provider, …), plus an optional case-level roster. Everything optional.
 */
function PersonnelEditor({
  people,
  onChange,
  compact = false,
}: {
  people: CasePersonnel[]
  onChange: (next: CasePersonnel[]) => void
  compact?: boolean
}) {
  return (
    <div className="space-y-1">
      {people.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={p.name}
            onChange={e => onChange(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            placeholder="Name / team (e.g. Bed Team 1)"
            className="flex-1 min-w-0 rounded border border-neutral-300 px-2 py-1 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
          <input
            type="text"
            list="r2ra-case-roles"
            value={p.role}
            onChange={e => onChange(people.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
            placeholder="Role"
            className="w-28 rounded border border-neutral-300 px-2 py-1 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />
          <button
            type="button"
            onClick={() => onChange(people.filter((_, j) => j !== i))}
            className="text-neutral-400 hover:text-red-600 text-xs px-0.5"
            aria-label="Remove person"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...people, { name: '', role: '' }])}
        className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-700 underline"
      >
        + Add {compact ? 'person' : 'personnel'}
      </button>
    </div>
  )
}

function CaseJourneyModal({
  assessmentId,
  scenarioCase,
  onClose,
  onSaved,
}: {
  assessmentId: string
  scenarioCase: ScenarioCase
  onClose: () => void
  onSaved: (c: ScenarioCase) => void
}) {
  const [journey, setJourney] = useState<CaseJourneyEntry[]>(scenarioCase.journey)
  const [roster, setRoster] = useState<CasePersonnel[]>(scenarioCase.personnel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addPhase(phase: CasePhase) {
    setJourney(prev => [
      ...prev,
      { phase, phase_label: null, time: null, notes: null, personnel: [] },
    ])
  }

  function setEntry(i: number, patch: Partial<CaseJourneyEntry>) {
    setJourney(prev => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  }

  function move(i: number, dir: -1 | 1) {
    setJourney(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const cleanRoster = roster.filter(p => p.name.trim() || p.role.trim())
      const cleanJourney = journey.map(e => ({
        ...e,
        personnel: e.personnel.filter(p => p.name.trim() || p.role.trim()),
      }))
      const updated = await api.updateCase(assessmentId, scenarioCase.id, {
        journey: cleanJourney,
        personnel: cleanRoster,
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6">
      {/* Shared role suggestions for all personnel role inputs */}
      <datalist id="r2ra-case-roles">
        {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
      </datalist>

      <div className="bg-neutral-50 w-full sm:max-w-lg sm:rounded-lg shadow-2 flex flex-col max-h-[92vh] sm:max-h-[85vh]">
        <div className="px-5 py-3.5 border-b border-neutral-300 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-neutral-900 truncate">
              Case journey — {scenarioCase.label}
            </h3>
            <p className="text-[10px] text-neutral-500">
              Track movement through the continuum of care. Everything here is optional.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600 shrink-0" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Journey summary chain */}
          {journey.length > 0 && (
            <p className="text-[11px] font-semibold" style={{ color: 'var(--signal-blue)' }}>
              {journey.map(e => phaseLabel(e)).join(' → ')}
            </p>
          )}

          {/* Phase entries */}
          {journey.map((e, i) => (
            <div key={i} className="rounded-lg border border-neutral-300 bg-neutral-100 p-3">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5"
                  style={{ background: 'rgba(91,122,139,0.20)', color: 'var(--signal-blue)' }}
                >
                  {i + 1}. {phaseLabel(e)}
                </span>
                <input
                  type="text"
                  value={e.time ?? ''}
                  onChange={ev => setEntry(i, { time: ev.target.value || null })}
                  placeholder="Time (e.g. 09:41)"
                  className="w-28 rounded border border-neutral-300 px-2 py-1 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                />
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-neutral-400 hover:text-neutral-600 disabled:opacity-30 text-xs px-0.5" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === journey.length - 1} className="text-neutral-400 hover:text-neutral-600 disabled:opacity-30 text-xs px-0.5" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => setJourney(prev => prev.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-red-600 text-xs px-0.5" aria-label="Remove phase">✕</button>
                </span>
              </div>

              {e.phase === 'other' && (
                <input
                  type="text"
                  value={e.phase_label ?? ''}
                  onChange={ev => setEntry(i, { phase_label: ev.target.value || null })}
                  placeholder="Phase name (e.g. Patient hold, X-ray)"
                  className="w-full mt-2 rounded border border-neutral-300 px-2 py-1 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                />
              )}

              <textarea
                value={e.notes ?? ''}
                onChange={ev => setEntry(i, { notes: ev.target.value || null })}
                rows={2}
                placeholder="What happened in this phase…"
                className="w-full mt-2 rounded border border-neutral-300 px-2 py-1.5 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              />

              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-2 mb-1">
                Personnel in this phase
              </p>
              <PersonnelEditor
                compact
                people={e.personnel}
                onChange={people => setEntry(i, { personnel: people })}
              />
            </div>
          ))}

          {/* Add phase */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">
              Add phase
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_META.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => addPhase(p.value)}
                  className="text-[10px] font-semibold rounded-full border px-2.5 py-1.5 transition-colors"
                  style={{ borderColor: 'var(--border-1)', color: 'var(--ink-2)' }}
                >
                  + {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Case-level roster */}
          <div className="border-t border-neutral-300 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">
              Case personnel (overall — bed team, surg tech, …)
            </p>
            <PersonnelEditor people={roster} onChange={setRoster} />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-300 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-700 px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-scarlet text-white text-xs font-bold px-5 py-2 hover:bg-scarlet-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save journey'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Per-wicket learning-objective feedback — collapsible row rendered under
 * each WicketCard. One feedback entry per evaluator per wicket.
 */
const REC_OPTIONS: { value: 'keep' | 'change' | 'drop'; label: string }[] = [
  { value: 'keep', label: 'Keep as-is' },
  { value: 'change', label: 'Change' },
  { value: 'drop', label: 'Drop' },
]

export function LoFeedbackRow({
  eventCode,
  mine,
  others,
  cases,
  onSave,
}: {
  eventCode: string
  mine: LoFeedback | undefined
  others: LoFeedback[]
  cases: ScenarioCase[]
  onSave: (eventCode: string, body: LoFeedbackUpsert) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(mine?.rating ?? null)
  const [rec, setRec] = useState<'keep' | 'change' | 'drop' | null>(mine?.recommendation ?? null)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [caseId, setCaseId] = useState<string | null>(mine?.case_id ?? null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const hasContent = mine || others.length > 0

  async function handleSave() {
    setState('saving')
    try {
      await onSave(eventCode, {
        rating,
        recommendation: rec,
        comment: comment.trim() || null,
        case_id: caseId,
      })
      setState('saved')
      setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="-mt-3 mb-4 mx-1 rounded-b border border-t-0 border-neutral-300 bg-neutral-100/60">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: hasContent ? 'var(--signal-blue)' : 'var(--ink-3)' }}>
          🎯 Learning objective feedback
        </span>
        {others.length > 0 && (
          <span className="text-[9px] text-neutral-400">{others.length + (mine ? 1 : 0)} entries</span>
        )}
        <span className="ml-auto text-[10px] text-neutral-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <p className="text-[10px] text-neutral-500 mb-1">Did the scenario/evaluation support this learning objective?</p>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? null : n)}
                  className="w-8 h-8 rounded border-2 text-xs font-bold transition-colors"
                  style={
                    rating === n
                      ? n >= 4
                        ? { borderColor: 'var(--signal-green)', background: 'rgba(107,127,79,0.22)', color: 'var(--signal-green)' }
                        : n >= 3
                        ? { borderColor: 'var(--signal-amber)', background: 'rgba(201,154,46,0.20)', color: 'var(--signal-amber)' }
                        : { borderColor: 'var(--signal-red)', background: 'rgba(179,58,58,0.18)', color: 'var(--signal-red)' }
                      : { borderColor: 'var(--border-1)', color: 'var(--ink-2)' }
                  }
                >
                  {n}
                </button>
              ))}
              <span className="text-[9px] text-neutral-400 ml-1">1=not at all · 5=fully</span>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {REC_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setRec(rec === o.value ? null : o.value)}
                className="text-[10px] font-semibold rounded-full border px-2.5 py-1 transition-colors"
                style={
                  rec === o.value
                    ? { background: 'rgba(91,122,139,0.22)', color: 'var(--signal-blue)', borderColor: 'var(--signal-blue)' }
                    : { borderColor: 'var(--border-1)', color: 'var(--ink-2)' }
                }
              >
                {o.label}
              </button>
            ))}
          </div>

          {cases.length > 0 && (
            <select
              value={caseId ?? ''}
              onChange={e => setCaseId(e.target.value || null)}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
            >
              <option value="">No linked case</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>Case: {c.label}</option>
              ))}
            </select>
          )}

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder="What to keep or change about this training objective next time…"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-[11px] bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={state === 'saving'}
              className="rounded bg-scarlet text-white text-[10px] font-bold px-3 py-1.5 disabled:opacity-50"
            >
              {state === 'saving' ? 'Saving…' : mine ? 'Update feedback' : 'Save feedback'}
            </button>
            {state === 'saved' && <span className="text-[10px]" style={{ color: 'var(--signal-green)' }}>✓ Saved</span>}
            {state === 'error' && <span className="text-[10px] text-red-600">Save failed</span>}
          </div>

          {others.length > 0 && (
            <div className="border-t border-neutral-300 pt-2 space-y-1.5">
              {others.map(f => (
                <div key={f.id} className="text-[10px] text-neutral-500">
                  <span className="font-semibold text-neutral-600">{f.author_name}</span>
                  {f.rating !== null && <> · {f.rating}/5</>}
                  {f.recommendation && <> · {f.recommendation}</>}
                  {f.comment && <span className="block italic">“{f.comment}”</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
