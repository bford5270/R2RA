import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useManifest, useSection } from '@/hooks/useContent'
import { SectionNav } from '@/components/preview/SectionNav'
import { AcronymProvider } from '@/components/preview/AcronymContext'
import { AcronymText } from '@/components/preview/AcronymText'
import { EvidencePanel } from '@/components/EvidencePanel'
import type { Assessment, AssessmentStatus, ItemResponse, ResponseStatus } from '../types/assessment'
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
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
}

function ResponseControls({ assessmentId, itemId, current, onSave }: ResponseControlsProps) {
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
      <div className="flex items-center gap-1.5">
        {(['yes', 'no', 'na'] as ResponseStatus[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => handleToggle(s)}
            className={`${btnBase} ${status === s ? active(s) : inactive}`}
          >
            {s.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowNote(v => !v)}
          className="text-[11px] text-neutral-400 hover:text-neutral-600 ml-1"
        >
          {showNote ? 'hide note' : 'add note'}
        </button>
        <button
          type="button"
          onClick={() => setShowAttach(v => !v)}
          className="text-[11px] text-neutral-400 hover:text-neutral-600"
          title="Attach evidence"
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
          onChange={e => handleNoteChange(e.target.value)}
          className="w-full rounded border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-scarlet/40 focus:border-scarlet resize-none"
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
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
  onSaveCapture: (itemId: string, captureData: Record<string, unknown>) => Promise<void>
  nested?: boolean
}

function ResponseItem({ assessmentId, item, responses, onSave, onSaveCapture, nested = false }: ResponseItemProps) {
  const indent = nested ? 'pl-4 border-l border-neutral-100 ml-2' : ''

  // Capture field state — hooks must be unconditional; only used for binary items with capture fields
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const existingCapture = (item.type === 'binary' && item.capture)
    ? (responses.get(item.id)?.capture_data ?? {}) as Record<string, string>
    : {}
  const [captureValues, setCaptureValues] = useState<Record<string, string>>(
    item.type === 'binary' && item.capture
      ? Object.fromEntries(item.capture.map(f => [f.id, String(existingCapture[f.id] ?? '')]))
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
            <ResponseItem key={sub.id} assessmentId={assessmentId} item={sub} responses={responses} onSave={onSave} onSaveCapture={onSaveCapture} nested />
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
        <ResponseControls assessmentId={assessmentId} itemId={item.id} current={responses.get(item.id)} onSave={onSave} />
      </div>
    )
  }

  if (item.type === 'text_long') {
    return (
      <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-sm text-neutral-800 leading-snug mb-2">
          <AcronymText text={item.label} />
        </p>
        <ResponseControls assessmentId={assessmentId} itemId={item.id} current={responses.get(item.id)} onSave={onSave} />
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
        <ResponseControls assessmentId={assessmentId} itemId={item.id} current={current} onSave={onSave} />
      </div>
    )
  }

  // table_counts and table_yn — show label + top-level YES/NO/NA
  const label = 'label' in item ? item.label : item.id
  return (
    <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
      <p className="text-sm text-neutral-800 leading-snug mb-1">
        <AcronymText text={label} />
      </p>
      <p className="text-xs text-neutral-400 italic mb-2">
        {item.type === 'table_counts' ? 'Count table — record overall assessment below' : 'Y/N table — record overall assessment below'}
      </p>
      <ResponseControls assessmentId={assessmentId} itemId={item.id} current={responses.get(item.id)} onSave={onSave} />
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
  onSave,
  onSaveCapture,
}: {
  assessmentId: string
  section: Section
  responses: Map<string, ItemResponse>
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
              <ResponseItem key={item.id} assessmentId={assessmentId} item={item} responses={responses} onSave={onSave} onSaveCapture={onSaveCapture} />
            ))}
          </div>
        ))}
        {section.items.map(item => (
          <ResponseItem key={item.id} assessmentId={assessmentId} item={item} responses={responses} onSave={onSave} onSaveCapture={onSaveCapture} />
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sectionId) return
    setLoading(true)
    api.getCrosswalk(sectionId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [sectionId])

  const confidenceColor = (c: string) =>
    c === 'high' ? 'text-green-600' : c === 'medium' ? 'text-yellow-600' : 'text-neutral-400'

  return (
    <aside className="w-72 shrink-0 border-l border-neutral-200 bg-neutral-50 overflow-y-auto hidden lg:flex flex-col">
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
            <p className="font-mono text-neutral-500 text-[10px] mb-1">{entry.jts_item}</p>
            {entry.wickets.map(w => (
              <div key={w.event_code} className="mb-1.5 pl-2 border-l-2 border-neutral-200">
                <Link
                  to={`/assessments/${assessmentId}/tr?wicket=${encodeURIComponent(w.event_code)}`}
                  className="font-mono text-scarlet hover:underline text-[10px]"
                  title="Open in T&R Assessment"
                >
                  {w.event_code} ↗
                </Link>
                <span className={`ml-1.5 text-[10px] font-semibold ${confidenceColor(w.confidence)}`}>
                  {w.confidence}
                </span>
                <p className="text-neutral-500 text-[10px] mt-0.5 leading-snug">{w.rationale}</p>
              </div>
            ))}
            {entry.mets?.map(m => (
              <div key={m.mct_task} className="mb-1 pl-2 border-l-2 border-blue-100">
                <span className="font-mono text-blue-600 text-[10px]">MCT {m.mct_task}</span>
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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([
      api.getAssessment(assessmentId),
      api.listResponses(assessmentId),
      api.listAssignments(assessmentId),
    ]).then(([a, rs, asgns]) => {
      setAssessment(a)
      setResponses(new Map(rs.map(r => [r.item_id, r])))
      setAssignments(asgns)
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

          {assessment.status === 'certified' && (
            <p className="text-[10px] text-green-600 font-semibold text-center">✓ Certified</p>
          )}

          <button
            onClick={jumpToUnanswered}
            className="w-full rounded border border-neutral-200 text-[11px] text-neutral-500 px-3 py-1 hover:border-neutral-400 hover:text-neutral-700 transition-colors"
          >
            → Jump to first unanswered
          </button>

          <div className="flex gap-2 pt-0.5">
            <Link
              to={`/assessments/${assessmentId}/tr`}
              className="flex-1 text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded px-2 py-1"
            >
              T&amp;R Assessment →
            </Link>
            <Link
              to={`/assessments/${assessmentId}/print`}
              className="flex-1 text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded px-2 py-1"
            >
              Print / PDF →
            </Link>
          </div>
          <TeamPanel
            assessmentId={assessmentId!}
            leadId={assessment.lead_id ?? ''}
            currentUserId={currentUser?.id ?? ''}
            assignments={assignments}
            visibleSections={visibleSections}
            onAssignmentsChange={setAssignments}
          />
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
              onSave={handleSave}
              onSaveCapture={handleSaveCapture}
            />
          )}
        </div>
      </main>

      {/* Right pane — T&R crosswalk */}
      <CrosswalkPanel sectionId={effectiveSectionId} assessmentId={assessmentId!} />
    </div>
  )
}
