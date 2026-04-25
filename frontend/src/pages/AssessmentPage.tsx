import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useManifest, useSection } from '@/hooks/useContent'
import { SectionNav } from '@/components/preview/SectionNav'
import { AcronymProvider } from '@/components/preview/AcronymContext'
import { AcronymText } from '@/components/preview/AcronymText'
import type { Assessment, AssessmentStatus, ItemResponse, ResponseStatus } from '../types/assessment'
import type { AssessmentItem, Section, SectionManifestEntry } from '@/types/content'
import type { CrosswalkEntry } from '../types/crosswalk'
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
  itemId: string
  current: ItemResponse | undefined
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
}

function ResponseControls({ itemId, current, onSave }: ResponseControlsProps) {
  const [note, setNote] = useState(current?.note ?? '')
  const [showNote, setShowNote] = useState(!!current?.note)
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item display + response
// ---------------------------------------------------------------------------

interface ResponseItemProps {
  item: AssessmentItem
  responses: Map<string, ItemResponse>
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
  nested?: boolean
}

function ResponseItem({ item, responses, onSave, nested = false }: ResponseItemProps) {
  const indent = nested ? 'pl-4 border-l border-neutral-100 ml-2' : ''

  if (item.type === 'group') {
    return (
      <div className={`py-2 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
          <AcronymText text={item.label} />
        </p>
        <div className="space-y-0">
          {item.sub_items.map(sub => (
            <ResponseItem key={sub.id} item={sub} responses={responses} onSave={onSave} nested />
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
                  className="flex-1 h-7 rounded border border-neutral-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-scarlet/40"
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        )}
        <ResponseControls itemId={item.id} current={responses.get(item.id)} onSave={onSave} />
      </div>
    )
  }

  if (item.type === 'text_long') {
    return (
      <div className={`py-3 border-b border-neutral-100 last:border-0 ${indent}`}>
        <p className="text-sm text-neutral-800 leading-snug mb-2">
          <AcronymText text={item.label} />
        </p>
        <ResponseControls itemId={item.id} current={responses.get(item.id)} onSave={onSave} />
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
        <ResponseControls itemId={item.id} current={current} onSave={onSave} />
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
      <ResponseControls itemId={item.id} current={responses.get(item.id)} onSave={onSave} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section with responses
// ---------------------------------------------------------------------------

function ResponseSectionView({
  section,
  responses,
  onSave,
}: {
  section: Section
  responses: Map<string, ItemResponse>
  onSave: (itemId: string, status: ResponseStatus, note: string | null) => Promise<void>
}) {
  return (
    <AcronymProvider key={section.id}>
      <div>
        <h2 className="text-base font-semibold text-neutral-900 mb-1">{section.title}</h2>
        {section.sections?.map(sub => (
          <div key={sub.id} className="mb-4">
            <h3 className="text-sm font-semibold text-neutral-700 mb-1 mt-3">{sub.title}</h3>
            {sub.items.map(item => (
              <ResponseItem key={item.id} item={item} responses={responses} onSave={onSave} />
            ))}
          </div>
        ))}
        {section.items.map(item => (
          <ResponseItem key={item.id} item={item} responses={responses} onSave={onSave} />
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

function CrosswalkPanel({ sectionId }: { sectionId: string | null }) {
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
                <span className="font-mono text-neutral-700">{w.event_code}</span>
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
// Page
// ---------------------------------------------------------------------------

export function AssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()
  const { data: manifest, isLoading: manifestLoading } = useManifest()
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const { data: section, isLoading: sectionLoading } = useSection(
    activeSectionId ?? manifest?.sections_manifest[0]?.id ?? null,
  )

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [responses, setResponses] = useState<Map<string, ItemResponse>>(new Map())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([
      api.getAssessment(assessmentId),
      api.listResponses(assessmentId),
    ]).then(([a, rs]) => {
      setAssessment(a)
      setResponses(new Map(rs.map(r => [r.item_id, r])))
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
        </div>
        <SectionNav
          sections={visibleSections}
          activeSectionId={effectiveSectionId}
          onSelect={setActiveSectionId}
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
              section={section}
              responses={responses}
              onSave={handleSave}
            />
          )}
        </div>
      </main>

      {/* Right pane — T&R crosswalk */}
      <CrosswalkPanel sectionId={effectiveSectionId} />
    </div>
  )
}
