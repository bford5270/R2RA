import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment } from '../types/assessment'
import type { TrResponse, TrResponseStatus } from '../types/assessment'
import type { TrFramework, TrWicket } from '../types/tr'
import { MISSION_TYPE_LABELS } from '../types/assessment'

// ---------------------------------------------------------------------------
// Scale constants
// ---------------------------------------------------------------------------

const SCORE_LABELS: Record<number, string> = {
  1: 'Non-performant',
  2: 'Significant deficiencies',
  3: 'Approaches standard',
  4: 'Meets standard',
  5: 'Exceeds standard',
}

const SCORE_ACTIVE: Record<number, string> = {
  1: 'border-red-500 bg-red-50 text-red-700',
  2: 'border-orange-400 bg-orange-50 text-orange-700',
  3: 'border-amber-400 bg-amber-50 text-amber-700',
  4: 'border-green-500 bg-green-50 text-green-700',
  5: 'border-green-600 bg-green-100 text-green-800',
}

// ---------------------------------------------------------------------------
// Reusable 1-5 Likert button row
// ---------------------------------------------------------------------------

function ScoreButtons({
  value,
  onChange,
  small = false,
}: {
  value: number | null
  onChange: (s: number | null) => void
  small?: boolean
}) {
  const base = small
    ? 'text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded border transition-colors select-none'
    : 'text-[11px] font-bold px-2 py-1 rounded border transition-colors select-none'
  const inactive = 'border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600'

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          // clicking the active score clears it (toggle off)
          onClick={() => onChange(value === n ? null : n)}
          className={`${base} ${value === n ? SCORE_ACTIVE[n] : inactive}`}
          title={SCORE_LABELS[n]}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score controls — per-component + overall, replaces binary GO/NO-GO
// ---------------------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function TrScoreControls({
  eventCode,
  components,
  current,
  onSave,
}: {
  eventCode: string
  components: string[]
  current: TrResponse | undefined
  onSave: (
    eventCode: string,
    status: TrResponseStatus,
    note: string | null,
    score: number | null,
    captureData: { components: (number | null)[] } | null,
  ) => Promise<void>
}) {
  const [showNote, setShowNote] = useState(!!current?.note)
  const [showComponents, setShowComponents] = useState(false)
  const [note, setNote] = useState(current?.note ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derive component scores from current response (backwards-compat: default to nulls)
  const compScores: (number | null)[] = useMemo(() => {
    const raw = current?.capture_data?.components
    if (!Array.isArray(raw)) return Array(components.length).fill(null)
    // Pad or trim to match current component count
    const result: (number | null)[] = Array(components.length).fill(null)
    raw.forEach((v, i) => {
      if (i < result.length) result[i] = typeof v === 'number' ? v : null
    })
    return result
  }, [current, components.length])

  const overallScore = current?.score ?? null

  // Auto-derive from component scores via weakest-link (min)
  const scoredComponents = compScores.filter((s): s is number => s !== null)
  const autoScore = scoredComponents.length > 0 ? Math.min(...scoredComponents) : null

  // Effective score: explicit override wins; else auto
  const effectiveScore = overallScore ?? autoScore

  function deriveStatus(score: number | null): TrResponseStatus {
    if (score === null) return current?.status ?? 'unanswered'
    return score >= 4 ? 'go' : 'no_go'
  }

  async function persist(
    nextOverall: number | null,
    nextComps: (number | null)[],
    nextNote: string | null,
  ) {
    const scored2 = nextComps.filter((s): s is number => s !== null)
    const auto2 = scored2.length > 0 ? Math.min(...scored2) : null
    const eff2 = nextOverall ?? auto2
    const status = deriveStatus(eff2)
    setSaveState('saving')
    try {
      await onSave(eventCode, status, nextNote, nextOverall, { components: nextComps })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1200)
    } catch {
      setSaveState('error')
    }
  }

  function handleOverall(s: number | null) {
    persist(s, compScores, note || null)
  }

  function handleComponent(idx: number, s: number | null) {
    const next = [...compScores]
    next[idx] = s
    persist(overallScore, next, note || null)
  }

  function handleNoteChange(val: string) {
    setNote(val)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      persist(overallScore, compScores, val || null)
    }, 600)
  }

  const statusLabel =
    effectiveScore === null
      ? '—'
      : effectiveScore >= 4
        ? '✓ GO'
        : '✗ NO-GO'
  const statusClass =
    effectiveScore === null
      ? 'text-neutral-400'
      : effectiveScore >= 4
        ? 'text-green-700 font-semibold'
        : 'text-red-600 font-semibold'

  return (
    <div className="mt-2 flex flex-col gap-2">
      {/* Overall score row */}
      <div className="flex items-center gap-2 flex-wrap">
        <ScoreButtons value={overallScore} onChange={handleOverall} />
        <span className={`text-[10px] ${statusClass}`}>{statusLabel}</span>
        {autoScore !== null && overallScore === null && (
          <span className="text-[10px] text-neutral-400 italic">
            auto: {autoScore} from components
          </span>
        )}
        <span className="ml-auto text-[10px]">
          {saveState === 'saving' && <span className="text-neutral-400">saving…</span>}
          {saveState === 'saved'  && <span className="text-green-600">saved</span>}
          {saveState === 'error'  && <span className="text-red-500">error</span>}
        </span>
      </div>

      {/* N/A option for non-applicable wickets */}
      {current?.status === 'na' || effectiveScore === null ? (
        <button
          type="button"
          onClick={() =>
            current?.status === 'na'
              ? persist(null, compScores, note || null)
              : onSave(eventCode, 'na', note || null, null, null)
          }
          className={[
            'self-start text-[10px] px-1.5 py-0.5 rounded border transition-colors',
            current?.status === 'na'
              ? 'border-neutral-400 bg-neutral-100 text-neutral-600'
              : 'border-neutral-200 text-neutral-300 hover:border-neutral-300 hover:text-neutral-500',
          ].join(' ')}
        >
          N/A
        </button>
      ) : null}

      {/* Component scoring (expandable) */}
      {components.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowComponents(v => !v)}
            className="text-[10px] text-neutral-400 hover:text-neutral-600 text-left"
          >
            {showComponents ? '▲ hide components' : '▼ score components'}
            {scoredComponents.length > 0 && (
              <span className="ml-1 text-neutral-500">
                ({scoredComponents.length}/{components.length} scored)
              </span>
            )}
          </button>

          {showComponents && (
            <div className="space-y-2 pl-2 border-l-2 border-neutral-100">
              {components.map((comp, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ScoreButtons
                    value={compScores[i] ?? null}
                    onChange={s => handleComponent(i, s)}
                    small
                  />
                  <p className="text-[10px] text-neutral-600 leading-snug flex-1">{comp}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Note */}
      <button
        type="button"
        onClick={() => setShowNote(v => !v)}
        className="self-start text-[10px] text-neutral-400 hover:text-neutral-600"
      >
        {showNote ? 'hide note' : 'add note'}
      </button>
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
// Score chip — compact summary shown in the wicket card header
// ---------------------------------------------------------------------------

function ScoreChip({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-[9px] text-neutral-300 ml-1">unscored</span>
  const color =
    score >= 4 ? 'text-green-700 bg-green-50 border-green-300' :
    score === 3 ? 'text-amber-700 bg-amber-50 border-amber-300' :
                  'text-red-700 bg-red-50 border-red-300'
  return (
    <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ml-1 ${color}`}>
      {score}/5
    </span>
  )
}

// ---------------------------------------------------------------------------
// Wicket card
// ---------------------------------------------------------------------------

function WicketCard({
  wicket,
  response,
  onSave,
  highlighted = false,
}: {
  wicket: TrWicket
  response: TrResponse | undefined
  highlighted?: boolean
  onSave: (
    eventCode: string,
    status: TrResponseStatus,
    note: string | null,
    score: number | null,
    captureData: { components: (number | null)[] } | null,
  ) => Promise<void>
}) {
  const [showDetails, setShowDetails] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlighted])

  // Compute effective score for the status dot
  const compScores: (number | null)[] = useMemo(() => {
    const raw = response?.capture_data?.components
    if (!Array.isArray(raw)) return []
    return raw.map(v => typeof v === 'number' ? v : null)
  }, [response])

  const overallScore = response?.score ?? null
  const scoredComps = compScores.filter((s): s is number => s !== null)
  const autoScore = scoredComps.length > 0 ? Math.min(...scoredComps) : null
  const effectiveScore = overallScore ?? autoScore

  const derivedStatus =
    effectiveScore !== null
      ? effectiveScore >= 4 ? 'go' : 'no_go'
      : response?.status ?? 'unanswered'

  const statusDot: Record<string, string> = {
    go:         'bg-green-500',
    no_go:      'bg-red-500',
    na:         'bg-neutral-400',
    unanswered: 'bg-neutral-200',
  }

  const components = wicket.event_components ?? []

  return (
    <div
      ref={cardRef}
      className={[
        'border rounded-lg p-4 mb-3 transition-colors',
        highlighted ? 'border-scarlet ring-1 ring-scarlet/30 bg-scarlet/5' : 'border-neutral-200',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${statusDot[derivedStatus]}`}
          title={derivedStatus}
        />
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] font-mono text-neutral-400 shrink-0">{wicket.event_code}</span>
            {wicket.readiness_coded && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-blue-500 bg-blue-50 rounded px-1">Readiness</span>
            )}
            {wicket.evaluation_coded && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 rounded px-1">Eval</span>
            )}
            <ScoreChip score={effectiveScore} />
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

          <TrScoreControls
            eventCode={wicket.event_code}
            components={components}
            current={response}
            onSave={onSave}
          />

          {(wicket.condition || wicket.standard) && (
            <button
              type="button"
              onClick={() => setShowDetails(v => !v)}
              className="mt-2 text-[10px] text-neutral-400 hover:text-neutral-600"
            >
              {showDetails ? '▲ hide condition / standard' : '▼ show condition / standard'}
            </button>
          )}

          {showDetails && (
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAnswered(r: TrResponse | undefined): boolean {
  if (!r) return false
  if (r.score !== null && r.score !== undefined) return true
  const comps = r.capture_data?.components
  if (Array.isArray(comps) && comps.some(s => s !== null)) return true
  return r.status !== 'unanswered'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function TrPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const [searchParams] = useSearchParams()
  const linkedWicket = searchParams.get('wicket')

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
      if (linkedWicket) {
        const target = framework.wickets.find(w => w.event_code === linkedWicket)
        setActiveChapter(target?.chapter ?? framework.chapters[0]?.number ?? null)
      } else {
        setActiveChapter(framework.chapters[0]?.number ?? null)
      }
    }).catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load'))
  }, [assessmentId, linkedWicket])

  const handleSave = useCallback(async (
    eventCode: string,
    status: TrResponseStatus,
    note: string | null,
    score: number | null,
    captureData: { components: (number | null)[] } | null,
  ) => {
    if (!assessmentId) return
    const updated = await api.upsertTrResponse(assessmentId, eventCode, {
      status,
      note,
      score,
      capture_data: captureData,
    })
    setResponses(prev => new Map(prev).set(eventCode, updated))
  }, [assessmentId])

  if (loadError) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-red-600">{loadError}</div>
  }
  if (!assessment || !tr) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">Loading…</div>
  }

  const chaptersWithWickets = tr.chapters.filter(ch =>
    tr.wickets.some(w => w.chapter === ch.number)
  )
  const activeWickets = tr.wickets.filter(w => w.chapter === activeChapter)

  function chapterCounts(chNum: number) {
    const wickets = tr!.wickets.filter(w => w.chapter === chNum)
    const answered = wickets.filter(w => isAnswered(responses.get(w.event_code))).length
    return { answered, total: wickets.length }
  }

  const totalAnswered = [...responses.values()].filter(isAnswered).length
  const goCount = tr.wickets.filter(w => {
    const r = responses.get(w.event_code)
    if (!r) return false
    const eff = r.score ?? (() => {
      const comps = r.capture_data?.components
      const scored = Array.isArray(comps) ? comps.filter((s): s is number => s !== null) : []
      return scored.length ? Math.min(...scored) : null
    })()
    return eff !== null ? eff >= 4 : r.status === 'go'
  }).length
  const noGoCount = tr.wickets.filter(w => {
    const r = responses.get(w.event_code)
    if (!r) return false
    const eff = r.score ?? (() => {
      const comps = r.capture_data?.components
      const scored = Array.isArray(comps) ? comps.filter((s): s is number => s !== null) : []
      return scored.length ? Math.min(...scored) : null
    })()
    return eff !== null ? eff < 4 : r.status === 'no_go'
  }).length

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
            <p>
              {totalAnswered} / {tr.wickets.length} scored ·{' '}
              <span className="text-green-600 font-semibold">{goCount} GO</span> ·{' '}
              <span className="text-red-600 font-semibold">{noGoCount} NO-GO</span>
            </p>
            <p className="text-neutral-300 text-[9px]">1=non-performant · 4=meets std · 5=exceeds</p>
          </div>
          <Link
            to={`/assessments/${assessmentId}/tr/print`}
            className="block text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 rounded px-2 py-1 mt-1"
          >
            Print / Export PDF →
          </Link>
        </div>

        <div className="px-2 pt-2 pb-1 border-b border-neutral-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 px-1 pb-1">
            NAVMC 3500.84B Chapters
          </p>
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
                  {chapterCounts(activeChapter).answered} of {chapterCounts(activeChapter).total} scored
                </p>
              </div>
              {activeWickets.map(w => (
                <WicketCard
                  key={w.event_code}
                  wicket={w}
                  response={responses.get(w.event_code)}
                  highlighted={linkedWicket === w.event_code}
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
