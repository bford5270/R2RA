import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useManifest, useSection } from '@/hooks/useContent'
import { SectionNav } from '@/components/preview/SectionNav'
import { AcronymProvider } from '@/components/preview/AcronymContext'
import { AcronymText } from '@/components/preview/AcronymText'
import type { Assessment, ItemResponse, ResponseStatus } from '../types/assessment'
import type { AssessmentItem, Section } from '@/types/content'
import { MISSION_TYPE_LABELS } from '../types/assessment'

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

  const effectiveSectionId = activeSectionId ?? manifest?.sections_manifest[0]?.id ?? null

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

  const answered = responses.size
  const total = manifest?.sections_manifest.length ?? 0

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left pane — section nav */}
      <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white overflow-y-auto flex flex-col">
        <div className="px-3 pt-4 pb-3 border-b border-neutral-100">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-neutral-400 hover:text-neutral-600 mb-2 block"
          >
            ← Assessments
          </button>
          <p className="text-xs font-bold text-neutral-800 leading-tight">{assessment.unit_name}</p>
          <p className="text-[11px] text-neutral-500 font-mono">{assessment.unit_uic}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">{MISSION_TYPE_LABELS[assessment.mission_type]}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-1.5 flex-1 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-scarlet rounded-full transition-all"
                style={{ width: total ? `${(answered / total) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-[10px] text-neutral-400">{answered} items</span>
          </div>
        </div>
        <SectionNav
          sections={manifest.sections_manifest}
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
    </div>
  )
}
