import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment } from '../types/assessment'
import type { TrResponse, TrResponseStatus } from '../types/assessment'
import type { TrFramework, TrChapter, TrWicket } from '../types/tr'
import { MISSION_TYPE_LABELS } from '../types/assessment'

// ---------------------------------------------------------------------------
// GO/NO-GO controls
// ---------------------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function TrControls({
  eventCode,
  current,
  onSave,
}: {
  eventCode: string
  current: TrResponse | undefined
  onSave: (eventCode: string, status: TrResponseStatus, note: string | null) => Promise<void>
}) {
  const [note, setNote] = useState(current?.note ?? '')
  const [showNote, setShowNote] = useState(!!current?.note)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const status = current?.status ?? 'unanswered'

  async function handleToggle(next: TrResponseStatus) {
    if (next === status) return
    setSaveState('saving')
    try {
      await onSave(eventCode, next, note || null)
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
        await onSave(eventCode, status === 'unanswered' ? 'unanswered' : status, val || null)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1200)
      } catch {
        setSaveState('error')
      }
    }, 600)
  }

  const btnBase = 'text-[11px] font-bold px-2.5 py-1 rounded border transition-colors select-none'
  const activeClass: Record<TrResponseStatus, string> = {
    go:          'border-green-500 bg-green-50 text-green-700',
    no_go:       'border-red-400 bg-red-50 text-red-700',
    na:          'border-neutral-400 bg-neutral-100 text-neutral-600',
    unanswered:  '',
  }
  const inactive = 'border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600'

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {(['go', 'no_go', 'na'] as TrResponseStatus[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => handleToggle(s)}
            className={`${btnBase} ${status === s ? activeClass[s] : inactive}`}
          >
            {s === 'go' ? 'GO' : s === 'no_go' ? 'NO-GO' : 'N/A'}
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
// Wicket card
// ---------------------------------------------------------------------------

function WicketCard({
  wicket,
  response,
  onSave,
}: {
  wicket: TrWicket
  response: TrResponse | undefined
  onSave: (eventCode: string, status: TrResponseStatus, note: string | null) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const status = response?.status ?? 'unanswered'

  const statusDot: Record<string, string> = {
    go:          'bg-green-500',
    no_go:       'bg-red-500',
    na:          'bg-neutral-400',
    unanswered:  'bg-neutral-200',
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-4 mb-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${statusDot[status]}`}
          title={status}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] font-mono text-neutral-400 shrink-0">{wicket.event_code}</span>
            {wicket.readiness_coded && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-blue-500 bg-blue-50 rounded px-1">Readiness</span>
            )}
            {wicket.evaluation_coded && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 rounded px-1">Eval</span>
            )}
          </div>
          <p className="text-sm font-semibold text-neutral-800 leading-snug mb-2">{wicket.title}</p>

          {wicket.mets_extracted && wicket.mets_extracted.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {wicket.mets_extracted.map(m => (
                <span
                  key={m.id}
                  className="text-[10px] font-mono bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 border border-blue-100"
                  title={m.description}
                >
                  {m.id}
                </span>
              ))}
            </div>
          )}

          <TrControls eventCode={wicket.event_code} current={response} onSave={onSave} />

          {(wicket.condition || wicket.standard || wicket.event_components?.length) && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="mt-2 text-[10px] text-neutral-400 hover:text-neutral-600"
            >
              {expanded ? '▲ hide details' : '▼ show details'}
            </button>
          )}

          {expanded && (
            <div className="mt-2 space-y-2 text-[11px] text-neutral-600">
              {wicket.condition && (
                <div>
                  <p className="font-semibold text-neutral-500 uppercase text-[9px] tracking-wide mb-0.5">Condition</p>
                  <p className="leading-snug">{wicket.condition}</p>
                </div>
              )}
              {wicket.standard && (
                <div>
                  <p className="font-semibold text-neutral-500 uppercase text-[9px] tracking-wide mb-0.5">Standard</p>
                  <p className="leading-snug">{wicket.standard}</p>
                </div>
              )}
              {wicket.event_components && wicket.event_components.length > 0 && (
                <div>
                  <p className="font-semibold text-neutral-500 uppercase text-[9px] tracking-wide mb-0.5">Event Components</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {wicket.event_components.map((c, i) => (
                      <li key={i} className="leading-snug">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function TrPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [tr, setTr] = useState<TrFramework | null>(null)
  const [responses, setResponses] = useState<Map<string, TrResponse>>(new Map())
  const [activeChapter, setActiveChapter] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([
      api.getAssessment(assessmentId),
      api.getTrFramework(),
      api.listTrResponses(assessmentId),
    ]).then(([a, framework, rs]) => {
      setAssessment(a)
      setTr(framework)
      setResponses(new Map(rs.map(r => [r.event_code, r])))
      // Default to first chapter that has wickets
      const firstCh = framework.chapters[0]?.number ?? null
      setActiveChapter(firstCh)
    }).catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load'))
  }, [assessmentId])

  const handleSave = useCallback(async (
    eventCode: string,
    status: TrResponseStatus,
    note: string | null,
  ) => {
    if (!assessmentId) return
    const updated = await api.upsertTrResponse(assessmentId, eventCode, { status, note })
    setResponses(prev => new Map(prev).set(eventCode, updated))
  }, [assessmentId])

  if (loadError) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-red-600">{loadError}</div>
  }

  if (!assessment || !tr) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">Loading…</div>
  }

  // Build chapter list — only chapters that have wickets
  const chaptersWithWickets = tr.chapters.filter(ch =>
    tr.wickets.some(w => w.chapter === ch.number)
  )

  const activeWickets = tr.wickets.filter(w => w.chapter === activeChapter)

  // Completion counts per chapter
  function chapterCounts(chNum: number) {
    const wickets = tr!.wickets.filter(w => w.chapter === chNum)
    const answered = wickets.filter(w => {
      const r = responses.get(w.event_code)
      return r && r.status !== 'unanswered'
    }).length
    return { answered, total: wickets.length }
  }

  const totalAnswered = [...responses.values()].filter(r => r.status !== 'unanswered').length
  const goCount = [...responses.values()].filter(r => r.status === 'go').length
  const noGoCount = [...responses.values()].filter(r => r.status === 'no_go').length

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left pane — chapter nav */}
      <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white overflow-y-auto flex flex-col">
        <div className="px-3 pt-4 pb-3 border-b border-neutral-100 space-y-1.5">
          <Link
            to={`/assessments/${assessmentId}`}
            className="text-xs text-neutral-400 hover:text-neutral-600 block"
          >
            ← JTS Assessment
          </Link>
          <p className="text-xs font-bold text-neutral-800 leading-tight">{assessment.unit_name}</p>
          <p className="text-[11px] font-mono text-neutral-500">{assessment.unit_uic}</p>
          <p className="text-[11px] text-neutral-500">{MISSION_TYPE_LABELS[assessment.mission_type]}</p>
          <div className="pt-1 text-[10px] text-neutral-400 space-y-0.5">
            <p>{totalAnswered} / {tr.wickets.length} answered · <span className="text-green-600 font-semibold">{goCount} GO</span> · <span className="text-red-600 font-semibold">{noGoCount} NO-GO</span></p>
          </div>
        </div>

        <div className="px-2 pt-2 pb-1 border-b border-neutral-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 px-1 pb-1">NAVMC 3500.84B Chapters</p>
        </div>

        <nav className="flex flex-col gap-0.5 py-2">
          {chaptersWithWickets.map(ch => {
            const { answered, total } = chapterCounts(ch.number)
            const isActive = activeChapter === ch.number
            return (
              <button
                key={ch.number}
                onClick={() => setActiveChapter(ch.number)}
                className={[
                  'flex items-start gap-2 px-3 py-2 rounded text-left transition-colors',
                  isActive
                    ? 'bg-scarlet text-white font-semibold'
                    : 'text-neutral-700 hover:bg-neutral-100',
                ].join(' ')}
              >
                <span className={[
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0 border mt-0.5',
                  isActive ? 'border-white/40 text-white' : 'border-neutral-300 text-neutral-400',
                ].join(' ')}>
                  {ch.number}
                </span>
                <span className="flex-1 leading-snug text-xs">{ch.title}</span>
                <span className={['text-[9px] shrink-0 mt-0.5', isActive ? 'text-white/70' : 'text-neutral-400'].join(' ')}>
                  {answered}/{total}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main pane — wickets */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {activeChapter !== null && (
            <>
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5">
                  Chapter {activeChapter} · T&R Wickets
                </p>
                <h2 className="text-base font-bold text-neutral-900">
                  {chaptersWithWickets.find(c => c.number === activeChapter)?.title ?? ''}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {chapterCounts(activeChapter).answered} of {chapterCounts(activeChapter).total} answered
                </p>
              </div>
              {activeWickets.map(w => (
                <WicketCard
                  key={w.event_code}
                  wicket={w}
                  response={responses.get(w.event_code)}
                  onSave={handleSave}
                />
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
