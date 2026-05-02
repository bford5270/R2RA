import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { encryptBundle, decryptBundle } from '../lib/bundle'
import { useAuth } from '../lib/auth'
import { useManifest, useSection } from '@/hooks/useContent'
import { SectionNav } from '@/components/preview/SectionNav'
import { AcronymProvider } from '@/components/preview/AcronymContext'
import { AcronymText } from '@/components/preview/AcronymText'
import { EvidencePanel } from '@/components/EvidencePanel'
import type { Assessment, AssessmentStatus, ItemResponse, ReadinessSummary, ResponseStatus, SignatureOut } from '../types/assessment'
import type { AssessmentItem, Section, SectionManifestEntry } from '@/types/content'
import type { CrosswalkEntry } from '../types/crosswalk'
import type { UserOut, AssignmentOut } from '../types/user'
import { MISSION_TYPE_LABELS } from '../types/assessment'

function isVisible(section: SectionManifestEntry, missionType: string): boolean {
  if (!section.visible_when) return true
  const mt = section.visible_when.mission_type
  return !mt || mt === missionType
}

// ---------------------------------------------------------------------------
// Response controls
// ---------------------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface ResponseControlsProps {
  assessmentId: string
  itemId: string
  current: ItemResponse | undefined
  locked: boolean
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
}

function ResponseControls({ assessmentId, itemId, current, locked, onSave }: ResponseControlsProps) {
  const [note, setNote] = useState(current?.note ?? '')
  const [showNote, setShowNote] = useState(!!current?.note)
  const [showAttach, setShowAttach] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const status = current?.status ?? 'unanswered'

  async function handleToggle(next: ResponseStatus) {
    if (next === status) return
    setSaveState('saving')
    try {
      await onSave(itemId, next, note || null)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1200)
    } catch {
      setSaveState('error')
    }
  }

  function handleNoteChange(val: string) {
    setNote(val)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        await onSave(itemId, (status === 'unanswered' ? 'unanswered' : status) as ResponseStatus, val || null)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1200)
      } catch {
        setSaveState('error')
      }
    }, 600)
  }

  const btnBase = 'text-[11px] font-bold px-2 py-1 rounded border transition-colors select-none'
  const active = (s: ResponseStatus) => ({
    yes:  'border-green-500 bg-green-50 text-green-700',
    no:   'border-red-400 bg-red-50 text-red-700',
    na:   'border-neutral-400 bg-neutral-100 text-neutral-600',
    unanswered: '',
  }[s])
  const inactive = 'border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600'

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {locked && (
        <p className="text-[10px] text-green-600 font-semibold">✓ Certified — read-only</p>
      )}
      <div className="flex items-center gap-1.5">
        {(['yes', 'no', 'na'] as ResponseStatus[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => !locked && handleToggle(s)}
            disabled={locked}
            className={`${btnBase} ${status === s ? active(s) : inactive} ${locked ? 'opacity-50 cursor-default' : ''}`}
          >
            {s.toUpperCase()}
          </button>
        ))}
        {!locked && (
          <button
            type="button"
            onClick={() => setShowNote(v => !v)}
            className="text-[11px] text-neutral-400 hover:text-neutral-600 ml-1"
          >
            {showNote ? 'hide note' : 'add note'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAttach(v => !v)}
          className="text-[11px] text-neutral-400 hover:text-neutral-600"
          title="View evidence"
        >
          📎
        </button>
        {saveState === 'saving' && <span className="text-[10px] text-neutral-400 ml-auto">saving…</span>}
        {saveState === 'saved'  && <span className="text-[10px] text-green-600 ml-auto">saved</span>}
        {saveState === 'error'  && <span className="text-[10px] text-red-500 ml-auto">error</span>}
      </div>

      {showNote && (
        <textarea
          rows={2}
          placeholder="Note…"
          value={note}
          readOnly={locked}
          onChange={e => !locked && handleNoteChange(e.target.value)}
          className={`w-full rounded border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-scarlet/40 focus:border-scarlet resize-none ${locked ? 'bg-neutral-50 cursor-default' : ''}`}
        />
      )}

      {showAttach && (
        <EvidencePanel assessmentId={assessmentId} itemId={itemId} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item display + response
// ---------------------------------------------------------------------------

interface ResponseItemProps {
  assessmentId: string
  item: AssessmentItem
  responses: Map<string, ItemResponse>
  locked: boolean
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
  onSaveCapture: (itemId: string, captureData: Record<string, unknown>) => Promise<void>
  nested?: boolean
}

function ResponseItem({ assessmentId, item, responses, locked, onSave, onSaveCapture, nested = false }: ResponseItemProps) {
  const indent = nested ? 'pl-4 border-l border-neutral-100 ml-2' : ''

  // Capture field state — hooks must be unconditional; only used for binary items with capture fields
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const existingCapture = ((item.type === 'binary' && item.capture) || item.type === 'table_yn' || item.type === 'table_counts')
    ? (responses.get(item.id)?.capture_data ?? {}) as Record<string, string>
    : {}
  const [captureValues, setCaptureValues] = useState<Record<string, string>>(
    item.type === 'binary' && item.capture
      ? Object.fromEntries(item.capture.map(f => [f.id, String(existingCapture[f.id] ?? '')]))
      : item.type === 'table_yn'
      ? Object.fromEntries(item.rows.map(r => [r.id, String(existingCapture[r.id] ?? '')]))
      : item.type === 'table_counts'
      ? Object.fromEntries(item.rows.flatMap(r => item.columns.map(c => [`${r.id}__${c.id}`, String(existingCapture[`${r.id}__${c.id}`] ?? '')])))
      : {}
  )

  function handleCaptureChange(fieldId: string, value: string) {
    const next = { ...captureValues, [fieldId]: value }
    setCaptureValues(next)
    if (captureTimer.current) clearTimeout(captureTimer.current)
    captureTimer.current = setTimeout(() => { onSaveCapture(item.id, next) }, 600)
  }

  if (item.type === 'group') {
    return (
      <div className={`py-2 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
          <AcronymText text={item.label} />
        </p>
        <div className="space-y-0">
          {item.sub_items.map(sub => (
            <ResponseItem key={sub.id} assessmentId={assessmentId} item={sub} responses={responses} locked={locked} onSave={onSave} onSaveCapture={onSaveCapture} nested />
          ))}
        </div>
      </div>
    )
  }

  if (item.type === 'binary') {
    return (
      <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-sm text-neutral-800 leading-snug">
          <AcronymText text={item.prompt} />
        </p>
        {item.capture && (
          <div className="mt-1.5 space-y-1">
            {item.capture.map(field => (
              <div key={field.id} className="flex items-center gap-2">
                <label className="text-xs text-neutral-500 w-28 shrink-0">
                  <AcronymText text={field.label} />
                </label>
                <input
                  type="text"
                  value={captureValues[field.id] ?? ''}
                  onChange={e => handleCaptureChange(field.id, e.target.value)}
                  className="flex-1 h-7 rounded border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-scarlet/40"
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        )}
        <ResponseControls assessmentId={assessmentId} itemId={item.id} current={responses.get(item.id)} locked={locked} onSave={onSave} />
      </div>
    )
  }

  if (item.type === 'text_long') {
    return (
      <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-sm text-neutral-800 leading-snug mb-2">
          <AcronymText text={item.label} />
        </p>
        <ResponseControls assessmentId={assessmentId} itemId={item.id} current={responses.get(item.id)} locked={locked} onSave={onSave} />
      </div>
    )
  }

  if (item.type === 'select_one') {
    const current = responses.get(item.id)
    return (
      <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-sm text-neutral-800 leading-snug mb-2">
          <AcronymText text={item.prompt} />
        </p>
        <div className="flex flex-wrap gap-2 mb-1">
          {item.options.map(opt => (
            <span
              key={opt.value}
              className="inline-flex items-center rounded border border-neutral-200 bg-neutral-50 text-neutral-500 text-xs px-2 py-0.5"
            >
              {opt.label}
            </span>
          ))}
        </div>
        <ResponseControls assessmentId={assessmentId} itemId={item.id} current={current} locked={locked} onSave={onSave} />
      </div>
    )
  }

  if (item.type === 'table_yn') {
    return (
      <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-sm font-medium text-neutral-800 leading-snug mb-2">
          <AcronymText text={item.label} />
        </p>
        <div className="divide-y divide-neutral-100 mb-3 rounded border border-neutral-200 overflow-hidden">
          {item.rows.map(row => {
            const val = captureValues[row.id] ?? ''
            return (
              <div key={row.id} className="flex items-center gap-2 px-3 py-1.5 bg-white">
                <span className="flex-1 text-xs text-neutral-700">
                  <AcronymText text={row.label} />
                </span>
                {(['Y', 'N'] as const).map(opt => (
                  <button
                    key={opt}
                    disabled={locked}
                    onClick={() => handleCaptureChange(row.id, val === opt ? '' : opt)}
                    className={`w-8 h-6 rounded text-xs font-semibold border transition-colors ${
                      val === opt
                        ? opt === 'Y'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
        <ResponseControls assessmentId={assessmentId} itemId={item.id} current={responses.get(item.id)} locked={locked} onSave={onSave} />
      </div>
    )
  }

  if (item.type === 'table_counts') {
    return (
      <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-sm font-medium text-neutral-800 leading-snug mb-2">
          <AcronymText text={item.label} />
        </p>
        <div className="divide-y divide-neutral-100 rounded border border-neutral-200 overflow-hidden">
          {item.rows.map(row => (
            <div key={row.id} className="flex items-center gap-2 px-3 py-1.5 bg-white">
              <span className="flex-1 text-xs text-neutral-700">
                <AcronymText text={row.label} />
              </span>
              {item.columns.map(col => (
                <input
                  key={col.id}
                  type="number"
                  min={0}
                  disabled={locked}
                  value={captureValues[`${row.id}__${col.id}`] ?? ''}
                  onChange={e => handleCaptureChange(`${row.id}__${col.id}`, e.target.value)}
                  className="w-16 h-6 rounded border border-neutral-200 px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-scarlet/40 disabled:opacity-50"
                  placeholder="—"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // unknown type safety net
  const label = (item as unknown as { label?: string; id: string }).label ?? (item as unknown as { id: string }).id
  return (
    <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
      <p className="text-sm text-neutral-800 leading-snug mb-1">
        <AcronymText text={label} />
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section with responses
// ---------------------------------------------------------------------------

function ResponseSectionView({
  assessmentId,
  section,
  responses,
  locked,
  onSave,
  onSaveCapture,
}: {
  assessmentId: string
  section: Section
  responses: Map<string, ItemResponse>
  locked: boolean
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
  onSaveCapture: (itemId: string, captureData: Record<string, unknown>) => Promise<void>
}) {
  return (
    <AcronymProvider key={section.id}>
      <div>
        <h2 className="text-base font-semibold text-neutral-900 mb-1">{section.title}</h2>
        {section.sections?.map(sub => (
          <div key={sub.id} className="mb-4">
            <h3 className="text-sm font-semibold text-neutral-700 mb-1 mt-3">{sub.title}</h3>
            {sub.items.map(item => (
              <ResponseItem key={item.id} assessmentId={assessmentId} item={item} responses={responses} locked={locked} onSave={onSave} onSaveCapture={onSaveCapture} />
            ))}
          </div>
        ))}
        {section.items.map(item => (
          <ResponseItem key={item.id} assessmentId={assessmentId} item={item} responses={responses} locked={locked} onSave={onSave} onSaveCapture={onSaveCapture} />
        ))}
      </div>
    </AcronymProvider>
  )
}

// ---------------------------------------------------------------------------
// Status button
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  draft:            'Draft',
  in_progress:      'In Progress',
  ready_for_review: 'Ready for Review',
  certified:        'Certified',
}
const STATUS_NEXT: Record<string, string> = {
  draft:            'in_progress',
  in_progress:      'ready_for_review',
  ready_for_review: 'certified',
}
const STATUS_NEXT_LABEL: Record<string, string> = {
  draft:            'Start',
  in_progress:      'Submit for Review',
  ready_for_review: 'Certify',
}
const STATUS_COLOR: Record<string, string> = {
  draft:            'bg-neutral-100 text-neutral-500',
  in_progress:      'bg-blue-50 text-blue-700',
  ready_for_review: 'bg-yellow-50 text-yellow-700',
  certified:        'bg-green-50 text-green-700',
}

// ---------------------------------------------------------------------------
// Crosswalk panel
// ---------------------------------------------------------------------------

function CrosswalkPanel({ sectionId, assessmentId }: { sectionId: string | null; assessmentId: string }) {
  const [entries, setEntries] = useState<CrosswalkEntry[]>([])
  const [summary, setSummary] = useState<ReadinessSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sectionId) return
    setLoading(true)
    Promise.all([
      api.getCrosswalk(sectionId),
      api.getReadinessSummary(assessmentId),
    ])
      .then(([e, s]) => { setEntries(e); setSummary(s) })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [sectionId, assessmentId])

  const confidenceColor = (c: string) =>
    c === 'high' ? 'text-green-600' : c === 'medium' ? 'text-yellow-600' : 'text-neutral-400'

  function wicketScoreChip(eventCode: string) {
    const w = summary?.wickets[eventCode]
    if (!w || w.score === null) return null
    const color =
      w.score >= 4 ? 'text-green-700 bg-green-50 border-green-300' :
      w.score === 3 ? 'text-amber-700 bg-amber-50 border-amber-300' :
                     'text-red-700 bg-red-50 border-red-300'
    return (
      <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ml-1 ${color}`}>
        {w.score}/5
      </span>
    )
  }

  function itemSuggestion(jtsItem: string) {
    const fwd = summary?.jts_forward[jtsItem]
    if (!fwd || fwd.suggested_status === null || fwd.scored_count === 0) return null
    const color =
      fwd.suggested_status === 'yes'      ? 'text-green-700 bg-green-50 border-green-200' :
      fwd.suggested_status === 'marginal' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                            'text-red-700 bg-red-50 border-red-200'
    const label =
      fwd.suggested_status === 'yes'      ? 'T&R → YES' :
      fwd.suggested_status === 'marginal' ? 'T&R → MARGINAL' : 'T&R → NO'
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${color}`}
        title={`Based on ${fwd.scored_count}/${fwd.total_wickets} wickets scored · min ${fwd.min_score}/5 · mean ${fwd.mean_score}/5`}
      >
        {label}
      </span>
    )
  }

  return (
    <aside className="w-72 shrink-0 border-l border-neutral-200 bg-neutral-50 overflow-y-auto flex flex-col">
      <div className="px-4 pt-4 pb-2 border-b border-neutral-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">T&amp;R Crosswalk</p>
        <p className="text-[10px] text-neutral-400 mt-0.5">NAVMC 3500.84B · draft, needs SME review</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {loading && <p className="text-xs text-neutral-400">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-neutral-400 italic">No crosswalk mappings for this section yet.</p>
        )}
        {entries.map(entry => (
          <div key={entry.jts_item} className="text-xs">
            {/* Item header with T&R suggestion */}
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <p className="font-mono text-neutral-500 text-[10px]">{entry.jts_item}</p>
              {itemSuggestion(entry.jts_item)}
            </div>
            {entry.wickets.map(w => (
              <div key={w.event_code} className="mb-1.5 pl-2 border-l-2 border-neutral-200">
                <div className="flex items-center gap-1 flex-wrap">
                  <Link
                    to={`/assessments/${assessmentId}/tr?wicket=${encodeURIComponent(w.event_code)}`}
                    className="font-mono text-scarlet hover:underline text-[10px]"
                    title="Open in T&R Assessment"
                  >
                    {w.event_code} ↗
                  </Link>
                  <span className={`text-[10px] font-semibold ${confidenceColor(w.confidence)}`}>
                    {w.confidence}
                  </span>
                  {wicketScoreChip(w.event_code)}
                </div>
                <p className="text-neutral-500 text-[10px] mt-0.5 leading-snug">{w.rationale}</p>
              </div>
            ))}
            {entry.mets?.map(m => (
              <div key={m.id} className="mb-1 pl-2 border-l-2 border-blue-100">
                <span className="font-mono text-blue-600 text-[10px]">{m.id}</span>
                <span className={`ml-1.5 text-[10px] ${confidenceColor(m.confidence)}`}>{m.confidence}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Certify modal
// ---------------------------------------------------------------------------

const SIGNER_ROLES = [
  { value: 'lead_assessor',    label: 'Lead Assessor / Certifier' },
  { value: 'tmd',              label: 'TMD Representative' },
  { value: 'unit_oic',         label: 'Unit OIC / SMO' },
  { value: 'arst_chief',       label: 'ARST Chief' },
]

function CertifyModal({
  assessmentId,
  defaultName,
  onCertified,
  onCancel,
}: {
  assessmentId: string
  defaultName: string
  onCertified: (a: Assessment) => void
  onCancel: () => void
}) {
  const [printName, setPrintName] = useState(defaultName)
  const [signerRole, setSignerRole] = useState('lead_assessor')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmed) { setError('Check the certification statement.'); return }
    if (!printName.trim()) { setError('Print name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await api.certify(assessmentId, printName.trim(), signerRole)
      onCertified(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Certification failed.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
      >
        <div>
          <h2 className="text-base font-bold text-neutral-900">Sign and Certify</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            This action locks the assessment. Responses cannot be modified after certification.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
            Official printed name / rank / title
          </label>
          <input
            required
            value={printName}
            onChange={e => setPrintName(e.target.value)}
            className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-scarlet/40"
            placeholder="e.g. Capt. Jane Smith, USMC, TMD"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
            Signing capacity
          </label>
          <select
            value={signerRole}
            onChange={e => setSignerRole(e.target.value)}
            className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-scarlet/40"
          >
            {SIGNER_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-scarlet"
          />
          <span className="text-xs text-neutral-700 leading-snug">
            I certify that this Role 2 Readiness Assessment is complete, accurate to the best of
            my knowledge, and reflects the current capabilities of the assessed unit.
          </span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded bg-scarlet text-white text-sm font-semibold py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Certifying…' : 'Certify Assessment'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded border border-neutral-200 text-sm text-neutral-600 py-2 hover:border-neutral-400 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bundle export/import
// ---------------------------------------------------------------------------

function BundlePanel({ assessmentId }: { assessmentId: string }) {
  const [open, setOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    if (!passphrase.trim()) { setStatus('Enter a passphrase first.'); return }
    setBusy(true)
    setStatus(null)
    try {
      const [assessment, responses, trResponses, assignments] = await Promise.all([
        api.getAssessment(assessmentId),
        api.listResponses(assessmentId),
        api.listTrResponses(assessmentId),
        api.listAssignments(assessmentId),
      ])
      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        assessment,
        responses,
        tr_responses: trResponses,
        assignments,
      }
      const encrypted = await encryptBundle(payload, passphrase)
      const blob = new Blob([encrypted as unknown as ArrayBuffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `r2ra-${assessmentId.slice(0, 8)}.r2ra`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('Bundle exported.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!importFile) { setStatus('Select a .r2ra file first.'); return }
    if (!passphrase.trim()) { setStatus('Enter the passphrase.'); return }
    setBusy(true)
    setStatus(null)
    try {
      const buf = await importFile.arrayBuffer()
      const data = await decryptBundle(new Uint8Array(buf), passphrase) as {
        version: number
        exported_at: string
        assessment: { unit_name: string; unit_uic: string }
        responses: unknown[]
        tr_responses: unknown[]
      }
      setStatus(
        `Decrypted bundle — ${data.assessment.unit_name} (${data.assessment.unit_uic}), ` +
        `${data.responses.length} responses, exported ${new Date(data.exported_at).toLocaleString()}.`
      )
    } catch {
      setStatus('Decryption failed — wrong passphrase or corrupted file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-600 px-1 py-1"
      >
        <span>Bundle</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          <input
            type="password"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            placeholder="Passphrase"
            className="w-full rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-scarlet/40"
          />
          <button
            onClick={handleExport}
            disabled={busy}
            className="w-full rounded border border-neutral-200 text-[10px] text-neutral-500 px-2 py-1 hover:border-neutral-400 hover:text-neutral-700 disabled:opacity-50 transition-colors"
          >
            {busy ? '…' : '↓ Export encrypted bundle'}
          </button>
          <label className="block">
            <span className="text-[10px] text-neutral-400 block mb-0.5">Import .r2ra</span>
            <input
              type="file"
              accept=".r2ra"
              onChange={e => setImportFile(e.target.files?.[0] ?? null)}
              className="text-[10px] w-full"
            />
          </label>
          {importFile && (
            <button
              onClick={handleImport}
              disabled={busy}
              className="w-full rounded border border-neutral-200 text-[10px] text-neutral-500 px-2 py-1 hover:border-neutral-400 hover:text-neutral-700 disabled:opacity-50 transition-colors"
            >
              {busy ? '…' : '↑ Decrypt bundle'}
            </button>
          )}
          {status && (
            <p className="text-[10px] text-neutral-500 break-words">{status}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team panel
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function TeamPanel({
  assessmentId,
  leadId,
  currentUserId,
  assignments,
  visibleSections,
  onAssignmentsChange,
}: {
  assessmentId: string
  leadId: string
  currentUserId: string
  assignments: AssignmentOut[]
  visibleSections: SectionManifestEntry[]
  onAssignmentsChange: (updated: AssignmentOut[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [allUsers, setAllUsers] = useState<UserOut[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const isLead = currentUserId === leadId

  useEffect(() => {
    if (showForm && allUsers.length === 0) {
      api.listUsers().then(setAllUsers).catch(() => {})
    }
  }, [showForm, allUsers.length])

  const contributors = assignments.filter(a => a.role !== 'lead')
  const lead = assignments.find(a => a.role === 'lead')

  async function handleAssign() {
    if (!selectedUserId) return
    setSaving(true)
    try {
      const updated = await api.upsertAssignment(assessmentId, selectedUserId, {
        role: 'contributor',
        scope_ids: selectedSections,
      })
      const next = [...assignments.filter(a => a.user_id !== selectedUserId), updated]
      onAssignmentsChange(next)
      setShowForm(false)
      setSelectedUserId('')
      setSelectedSections([])
    } catch {
      // leave form open on error
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(a: AssignmentOut) {
    try {
      await api.deleteAssignment(assessmentId, a.id)
      onAssignmentsChange(assignments.filter(x => x.id !== a.id))
    } catch {
      // ignore
    }
  }

  function toggleSection(id: string) {
    setSelectedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const unassignedUsers = allUsers.filter(u =>
    u.id !== leadId && !assignments.some(a => a.user_id === u.id)
  )

  return (
    <div className="border-t border-neutral-100 pt-2 mt-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-600"
      >
        <span>Team ({assignments.length})</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {/* Lead */}
          {lead && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-scarlet text-white text-[9px] font-bold shrink-0">
                {initials(lead.display_name)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-neutral-700 truncate">{lead.display_name}</p>
                <p className="text-[9px] text-neutral-400">Lead Assessor</p>
              </div>
            </div>
          )}

          {/* Contributors */}
          {contributors.map(a => (
            <div key={a.id} className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold shrink-0 mt-0.5">
                {initials(a.display_name)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-neutral-700 truncate">{a.display_name}</p>
                <p className="text-[9px] text-neutral-400">
                  {a.scope_ids.length === 0
                    ? 'All sections'
                    : a.scope_ids.map(id => visibleSections.find(s => s.id === id)?.title ?? id).join(', ')}
                </p>
              </div>
              {isLead && (
                <button
                  onClick={() => handleRemove(a)}
                  className="text-[10px] text-neutral-300 hover:text-red-500 shrink-0 mt-0.5"
                  title="Remove assignment"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Add contributor button (lead only) */}
          {isLead && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full text-[10px] text-neutral-400 hover:text-scarlet border border-dashed border-neutral-200 hover:border-scarlet rounded py-1 transition-colors"
            >
              + Add contributor
            </button>
          )}

          {/* Assignment form */}
          {isLead && showForm && (
            <div className="border border-neutral-200 rounded p-2 space-y-2 bg-neutral-50">
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full text-xs rounded border border-neutral-200 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-scarlet/40"
              >
                <option value="">Select person…</option>
                {unassignedUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>

              <div className="space-y-1">
                <p className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wide">Assign sections (empty = all)</p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {visibleSections.map(s => (
                    <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(s.id)}
                        onChange={() => toggleSection(s.id)}
                        className="w-3 h-3 accent-scarlet"
                      />
                      <span className="text-[10px] text-neutral-700 leading-snug">{s.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={handleAssign}
                  disabled={!selectedUserId || saving}
                  className="flex-1 rounded bg-scarlet text-white text-[10px] font-semibold py-1 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Assign'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setSelectedUserId(''); setSelectedSections([]) }}
                  className="flex-1 rounded border border-neutral-200 text-[10px] text-neutral-500 py-1 hover:border-neutral-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { data: manifest, isLoading: manifestLoading } = useManifest()
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const { data: section, isLoading: sectionLoading } = useSection(
    activeSectionId ?? manifest?.sections_manifest[0]?.id ?? null,
  )

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [responses, setResponses] = useState<Map<string, ItemResponse>>(new Map())
  const [assignments, setAssignments] = useState<AssignmentOut[]>([])
  const [signatures, setSignatures] = useState<SignatureOut[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [showCertifyModal, setShowCertifyModal] = useState(false)
  const [showCrosswalk, setShowCrosswalk] = useState(false)

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([
      api.getAssessment(assessmentId),
      api.listResponses(assessmentId),
      api.listAssignments(assessmentId),
      api.listSignatures(assessmentId),
    ]).then(([a, rs, asgns, sigs]) => {
      setAssessment(a)
      setResponses(new Map(rs.map(r => [r.item_id, r])))
      setAssignments(asgns)
      setSignatures(sigs)
    }).catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load'))
  }, [assessmentId])

  const handleSave = useCallback(async (
    itemId: string,
    status: ResponseStatus,
    note: string | null,
  ) => {
    if (!assessmentId) return
    const updated = await api.upsertResponse(assessmentId, itemId, { status, note })
    setResponses(prev => new Map(prev).set(itemId, updated))
  }, [assessmentId])

  const handleSaveCapture = useCallback(async (
    itemId: string,
    captureData: Record<string, unknown>,
  ) => {
    if (!assessmentId) return
    const current = responses.get(itemId)
    const updated = await api.upsertResponse(assessmentId, itemId, {
      status: current?.status ?? 'unanswered',
      note: current?.note ?? null,
      capture_data: captureData,
    })
    setResponses(prev => new Map(prev).set(itemId, updated))
  }, [assessmentId, responses])

  async function handleAdvanceStatus() {
    if (!assessment || !assessmentId) return
    const next = STATUS_NEXT[assessment.status]
    if (!next) return
    if (next === 'certified') {
      setShowCertifyModal(true)
      return
    }
    setAdvancing(true)
    try {
      const updated = await api.advanceStatus(assessmentId, next)
      setAssessment(updated)
    } catch {
      // keep current status on error
    } finally {
      setAdvancing(false)
    }
  }

  const visibleSections = assessment && manifest
    ? manifest.sections_manifest.filter(s => isVisible(s, assessment.mission_type))
    : manifest?.sections_manifest ?? []

  const effectiveSectionId = activeSectionId ?? visibleSections[0]?.id ?? null

  function jumpToUnanswered() {
    if (!visibleSections.length) return
    for (const s of visibleSections) {
      const prefix = s.item_prefix
      if (!prefix) continue
      const hasAny = [...responses.keys()].some(k => k.startsWith(prefix + '.'))
      if (!hasAny) {
        setActiveSectionId(s.id)
        return
      }
    }
    // all sections have at least one response — find first with partial completion
    setActiveSectionId(visibleSections[0].id)
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-red-600">
        {loadError}
      </div>
    )
  }

  if (manifestLoading || !assessment) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">
        Loading…
      </div>
    )
  }

  const nextStatus = STATUS_NEXT[assessment.status]
  const answered = [...responses.values()].filter(r => r.status !== 'unanswered').length

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left pane — section nav */}
      <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white overflow-y-auto flex flex-col">
        <div className="px-3 pt-4 pb-3 border-b border-neutral-100 space-y-2">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-neutral-400 hover:text-neutral-600 block"
          >
            ← Assessments
          </button>
          <p className="text-xs font-bold text-neutral-800 leading-tight">{assessment.unit_name}</p>
          <p className="text-[11px] text-neutral-500 font-mono">{assessment.unit_uic}</p>
          <p className="text-[11px] text-neutral-500">{MISSION_TYPE_LABELS[assessment.mission_type]}</p>

          <div className="flex items-center justify-between pt-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[assessment.status]}`}>
              {STATUS_LABELS[assessment.status]}
            </span>
            <span className="text-[10px] text-neutral-400">{answered} answered</span>
          </div>

          {nextStatus && (
            <button
              onClick={handleAdvanceStatus}
              disabled={advancing}
              className="w-full rounded border border-neutral-300 text-xs text-neutral-600 font-medium px-3 py-1.5 hover:border-scarlet hover:text-scarlet transition-colors disabled:opacity-50"
            >
              {advancing ? 'Saving…' : STATUS_NEXT_LABEL[assessment.status] + ' →'}
            </button>
          )}

          {assessment.status === 'certified' && signatures.length > 0 && (
            <div className="rounded border border-green-200 bg-green-50 p-2 space-y-0.5">
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide">✓ Certified</p>
              {signatures.map(sig => (
                <div key={sig.id}>
                  <p className="text-[10px] text-green-800 font-semibold">{sig.print_name}</p>
                  <p className="text-[9px] text-green-600">
                    {SIGNER_ROLES.find(r => r.value === sig.role)?.label ?? sig.role} ·{' '}
                    {new Date(sig.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[8px] text-green-400 font-mono truncate" title={sig.payload_hash}>
                    {sig.payload_hash.slice(0, 16)}…
                  </p>
                </div>
              ))}
            </div>
          )}

          {assessment.status !== 'certified' && (
            <button
              onClick={jumpToUnanswered}
              className="w-full rounded border border-neutral-200 text-[11px] text-neutral-500 px-3 py-1 hover:border-neutral-400 hover:text-neutral-700 transition-colors"
            >
              → Jump to first unanswered
            </button>
          )}

          <div className="flex gap-2 pt-0.5">
            <Link
              to={`/assessments/${assessmentId}/tr`}
              className="flex-1 text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded px-2 py-1"
            >
              T&amp;R Assessment →
            </Link>
            <button
              onClick={() => setShowCrosswalk(v => !v)}
              className={[
                'flex-1 text-center text-[10px] border rounded px-2 py-1 transition-colors',
                showCrosswalk
                  ? 'text-scarlet border-scarlet/40 bg-scarlet/5'
                  : 'text-neutral-400 hover:text-neutral-600 border-neutral-200',
              ].join(' ')}
              title="Toggle T&R crosswalk panel"
            >
              T&amp;R Map {showCrosswalk ? '◀' : '▶'}
            </button>
            <Link
              to={`/assessments/${assessmentId}/print`}
              className="flex-1 text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded px-2 py-1"
            >
              Print / PDF →
            </Link>
            <Link
              to={`/assessments/${assessmentId}/audit`}
              className="flex-1 text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded px-2 py-1"
            >
              Audit log →
            </Link>
          </div>
          <Link
            to={`/units/${assessment.unit_uic}/library`}
            className="w-full text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded px-2 py-1 block"
          >
            Unit document library →
          </Link>
          <TeamPanel
            assessmentId={assessmentId!}
            leadId={assessment.lead_id ?? ''}
            currentUserId={currentUser?.id ?? ''}
            assignments={assignments}
            visibleSections={visibleSections}
            onAssignmentsChange={setAssignments}
          />
          <BundlePanel assessmentId={assessmentId!} />
        </div>
        <SectionNav
          sections={visibleSections}
          activeSectionId={effectiveSectionId}
          onSelect={setActiveSectionId}
          responses={responses}
          assignments={assignments}
        />
      </aside>

      {/* Main pane — items with response controls */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {sectionLoading && (
            <p className="text-sm text-neutral-400">Loading section…</p>
          )}
          {section && (
            <ResponseSectionView
              assessmentId={assessmentId!}
              section={section}
              responses={responses}
              locked={assessment?.status === 'certified'}
              onSave={handleSave}
              onSaveCapture={handleSaveCapture}
            />
          )}
        </div>
      </main>

      {/* Right pane — T&R crosswalk (collapsed by default) */}
      {showCrosswalk && <CrosswalkPanel sectionId={effectiveSectionId} assessmentId={assessmentId!} />}

      {showCertifyModal && (
        <CertifyModal
          assessmentId={assessmentId!}
          defaultName={currentUser?.display_name ?? ''}
          onCertified={updated => {
            setAssessment(updated)
            setShowCertifyModal(false)
            api.listSignatures(assessmentId!).then(setSignatures)
          }}
          onCancel={() => setShowCertifyModal(false)}
        />
      )}
    </div>
  )
}
