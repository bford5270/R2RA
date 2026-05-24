import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment, TrJtsEvidence } from '../types/assessment'
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

const SCORE_ACTIVE_STYLE: Record<number, React.CSSProperties> = {
  1: { borderColor: 'var(--signal-red)',   background: 'rgba(179,58,58,0.18)',  color: 'var(--signal-red)' },
  2: { borderColor: 'var(--signal-amber)', background: 'rgba(201,154,46,0.10)', color: 'var(--signal-amber)' },
  3: { borderColor: 'var(--signal-amber)', background: 'rgba(201,154,46,0.20)', color: 'var(--signal-amber)' },
  4: { borderColor: 'var(--signal-green)', background: 'rgba(107,127,79,0.22)', color: 'var(--signal-green)' },
  5: { borderColor: 'var(--signal-green)', background: 'rgba(107,127,79,0.32)', color: 'var(--signal-green)' },
}

// ---------------------------------------------------------------------------
// Reusable 1-5 Likert button row
// ---------------------------------------------------------------------------

function ScoreButtons({
  value,
  onChange,
  size = 'normal',
}: {
  value: number | null
  onChange: (s: number | null) => void
  size?: 'small' | 'normal' | 'field'
}) {
  const base =
    size === 'small'  ? 'text-[9px] font-bold w-6 h-6 flex items-center justify-center rounded border-2 transition-all select-none' :
    size === 'field'  ? 'text-base font-bold w-14 h-14 flex items-center justify-center rounded-lg border-2 transition-all select-none' :
                        'text-sm font-bold w-11 h-11 flex items-center justify-center rounded border-2 transition-all select-none'
  const inactive = 'border-neutral-400 bg-neutral-100 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700'

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`${base} ${value === n ? 'shadow-sm' : inactive}`}
          style={value === n ? SCORE_ACTIVE_STYLE[n] : undefined}
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
    captureData: { components: (number | null)[]; component_notes?: string[] } | null,
  ) => Promise<void>
}) {
  const [note, setNote] = useState(current?.note ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const compScores: (number | null)[] = useMemo(() => {
    const raw = current?.capture_data?.components
    if (!Array.isArray(raw)) return Array(components.length).fill(null)
    const result: (number | null)[] = Array(components.length).fill(null)
    raw.forEach((v, i) => {
      if (i < result.length) result[i] = typeof v === 'number' ? v : null
    })
    return result
  }, [current, components.length])

  const [compNotes, setCompNotes] = useState<string[]>(() => {
    const raw = (current?.capture_data as Record<string, unknown> | null)?.component_notes
    if (!Array.isArray(raw)) return Array(components.length).fill('')
    const result: string[] = Array(components.length).fill('')
    ;(raw as unknown[]).forEach((v, i) => {
      if (i < result.length) result[i] = typeof v === 'string' ? v : ''
    })
    return result
  })

  const overallScore = current?.score ?? null
  const scoredComponents = compScores.filter((s): s is number => s !== null)
  const autoScore = scoredComponents.length > 0 ? Math.min(...scoredComponents) : null
  const effectiveScore = overallScore ?? autoScore
  const isLowScore = effectiveScore !== null && effectiveScore <= 2

  function deriveStatus(score: number | null): TrResponseStatus {
    if (score === null) return current?.status ?? 'unanswered'
    return score >= 4 ? 'go' : 'no_go'
  }

  async function persist(
    nextOverall: number | null,
    nextComps: (number | null)[],
    nextNote: string | null,
    nextCompNotes: string[],
  ) {
    const scored2 = nextComps.filter((s): s is number => s !== null)
    const auto2 = scored2.length > 0 ? Math.min(...scored2) : null
    const eff2 = nextOverall ?? auto2
    const status = deriveStatus(eff2)
    setSaveState('saving')
    try {
      await onSave(eventCode, status, nextNote, nextOverall, {
        components: nextComps,
        component_notes: nextCompNotes,
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1200)
    } catch {
      setSaveState('error')
    }
  }

  function handleOverall(s: number | null) {
    persist(s, compScores, note || null, compNotes)
  }

  function handleComponent(idx: number, s: number | null) {
    const next = [...compScores]
    next[idx] = s
    persist(overallScore, next, note || null, compNotes)
  }

  function handleCompNote(idx: number, val: string) {
    const next = [...compNotes]
    next[idx] = val
    setCompNotes(next)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      persist(overallScore, compScores, note || null, next)
    }, 600)
  }

  function handleNote(val: string) {
    setNote(val)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      persist(overallScore, compScores, val || null, compNotes)
    }, 600)
  }

  const statusLabel = effectiveScore === null ? '—' : effectiveScore >= 4 ? '✓ GO' : '✗ NO-GO'
  const statusStyle: React.CSSProperties =
    effectiveScore === null ? { color: 'var(--ink-3)' } :
    effectiveScore >= 4    ? { color: 'var(--signal-green)', fontWeight: 700 } :
                             { color: 'var(--signal-red)',   fontWeight: 700 }

  return (
    <div className="mt-3 flex flex-col gap-4">

      {/* Scale legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {Object.entries(SCORE_LABELS).map(([n, label]) => (
          <span key={n} className="text-[10px] text-neutral-500">
            <span className="font-bold text-neutral-700">{n}</span> = {label}
          </span>
        ))}
      </div>

      {/* Per-component rows — always visible, form-style */}
      {components.length > 0 && (
        <div className="flex flex-col divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
          {components.map((comp, i) => (
            <div key={i} className="p-4 bg-white flex flex-col gap-3">
              <p className="text-sm font-semibold text-neutral-800 leading-snug">{comp}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <ScoreButtons
                  value={compScores[i] ?? null}
                  onChange={s => handleComponent(i, s)}
                  size="field"
                />
                {compScores[i] !== null && (
                  <span className="text-xs text-neutral-500 italic">{SCORE_LABELS[compScores[i]!]}</span>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Observations
                </label>
                <textarea
                  rows={2}
                  placeholder="Record observations…"
                  value={compNotes[i] ?? ''}
                  onChange={e => handleCompNote(i, e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overall score + N/A + save state */}
      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              {components.length > 0 ? 'Overall Score (override)' : 'Score'}
            </span>
            <div className="flex items-center gap-3">
              <ScoreButtons value={overallScore} onChange={handleOverall} />
              <span style={statusStyle} className="text-sm">{statusLabel}</span>
              {autoScore !== null && overallScore === null && (
                <span className="text-[10px] text-neutral-400 italic">auto: {autoScore} (weakest component)</span>
              )}
            </div>
          </div>
          <div className="flex items-end gap-3 ml-auto">
            <button
              type="button"
              onClick={() =>
                current?.status === 'na'
                  ? onSave(eventCode, 'unanswered', note || null, null, null)
                  : onSave(eventCode, 'na', note || null, null, null)
              }
              className={[
                'text-sm font-semibold px-4 py-2 rounded border-2 transition-all',
                current?.status === 'na'
                  ? 'border-neutral-500 bg-neutral-300 text-neutral-700'
                  : 'border-neutral-300 bg-neutral-100 text-neutral-400 hover:border-neutral-500 hover:text-neutral-600',
              ].join(' ')}
            >
              N/A
            </button>
            <span className="text-[10px] pb-1">
              {saveState === 'saving' && <span className="text-neutral-400">saving…</span>}
              {saveState === 'saved'  && <span className="text-green-600">saved</span>}
              {saveState === 'error'  && <span className="text-red-500">error</span>}
            </span>
          </div>
        </div>
      </div>

      {/* General / corrective action note — always visible */}
      <div>
        {isLowScore && (
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--signal-red)' }}>
            Training gap / corrective action required
          </p>
        )}
        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
          {isLowScore ? 'Corrective Action' : 'General Observations'}
        </label>
        <textarea
          rows={3}
          placeholder={isLowScore ? 'Describe training gap or corrective action…' : 'Overall observations…'}
          value={note}
          onChange={e => handleNote(e.target.value)}
          className={`w-full rounded border px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-1 resize-none ${isLowScore ? 'border-red-200 focus:ring-red-300 focus:border-red-300' : 'border-neutral-300 focus:ring-amber-500/40 focus:border-amber-500'}`}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JTS evidence panel — reverse crosswalk: JTS responses → this wicket
// ---------------------------------------------------------------------------

function JtsEvidencePanel({ evidence }: { evidence: TrJtsEvidence }) {
  const [open, setOpen] = useState(false)

  const signalStyle: Record<string, React.CSSProperties> = {
    go:         { color: 'var(--signal-green)' },
    no_go:      { color: 'var(--signal-red)' },
    mixed:      { color: 'var(--signal-amber)' },
    unanswered: { color: 'var(--ink-3)' },
  }
  const signalLabel: Record<string, string> = {
    go: 'JTS → suggests GO', no_go: 'JTS → suggests NO-GO',
    mixed: 'JTS → mixed', unanswered: 'JTS — no responses',
  }
  const statusStyle = (s: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '1px 5px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    background:
      s === 'yes' ? 'rgba(107,127,79,0.14)' :
      s === 'no'  ? 'rgba(179,58,58,0.14)'  :
      s === 'na'  ? 'var(--surface-2)'       : 'transparent',
    color:
      s === 'yes' ? 'var(--signal-green)' :
      s === 'no'  ? 'var(--signal-red)'   :
      s === 'na'  ? 'var(--ink-3)'        : 'var(--ink-4)',
  })
  const confidenceDot = (c: string) =>
    c === 'high' ? 'bg-green-500' : c === 'medium' ? 'bg-amber-400' : 'bg-neutral-300'

  if (evidence.total_count === 0) return null

  return (
    <div className="mt-2 border-t border-neutral-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[10px] hover:opacity-80 transition-opacity w-full"
      >
        <span style={signalStyle[evidence.signal]} className="font-semibold">
          {signalLabel[evidence.signal]}
        </span>
        <span className="text-neutral-400">
          ({evidence.yes_count} YES · {evidence.no_count} NO · {evidence.answered_count}/{evidence.total_count} answered)
        </span>
        <span className="ml-auto text-neutral-400">{open ? '▲' : '▼'} JTS items</span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-neutral-200">
          {evidence.items.map(item => (
            <div key={item.item_id} className="flex items-start gap-2">
              <span
                className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${confidenceDot(item.confidence)}`}
                title={`${item.confidence} confidence`}
              />
              <span className="font-mono text-[9px] text-neutral-400 shrink-0 w-14">{item.item_id}</span>
              <span style={statusStyle(item.status)}>{item.status === 'unanswered' ? '—' : item.status.toUpperCase()}</span>
              {item.rationale && (
                <span className="text-[9px] text-neutral-400 leading-snug flex-1 truncate" title={item.rationale}>
                  {item.rationale}
                </span>
              )}
            </div>
          ))}
        </div>
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
  evidence,
  onSave,
  highlighted = false,
}: {
  wicket: TrWicket
  response: TrResponse | undefined
  evidence: TrJtsEvidence | undefined
  highlighted?: boolean
  onSave: (
    eventCode: string,
    status: TrResponseStatus,
    note: string | null,
    score: number | null,
    captureData: { components: (number | null)[]; component_notes?: string[] } | null,
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

  const cardBorderStyle: React.CSSProperties = !highlighted ? {
    borderLeftColor:
      derivedStatus === 'unanswered' ? 'var(--signal-amber)' :
      derivedStatus === 'go'        ? 'var(--signal-green)' :
      derivedStatus === 'no_go'     ? 'var(--signal-red)'   :
      'var(--ink-3)',
    borderLeftWidth: '4px',
  } : {}

  return (
    <div
      id={wicket.event_code}
      ref={cardRef}
      className={[
        'border rounded-lg p-4 mb-3 transition-colors',
        highlighted ? 'border-scarlet ring-1 ring-scarlet/30 bg-scarlet/5' : 'border-neutral-300',
      ].join(' ')}
      style={cardBorderStyle}
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

          {evidence && <JtsEvidencePanel evidence={evidence} />}

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
  const [jtsEvidence, setJtsEvidence] = useState<Record<string, TrJtsEvidence>>({})
  const [activeChapter, setActiveChapter] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([
      api.getAssessment(assessmentId),
      api.getTrFramework(),
      api.listTrResponses(assessmentId),
      api.getTrJtsEvidence(assessmentId),
    ]).then(([a, framework, rs, evidence]) => {
      setAssessment(a)
      setTr(framework)
      setResponses(new Map(rs.map(r => [r.event_code, r])))
      setJtsEvidence(evidence)
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
    captureData: { components: (number | null)[]; component_notes?: string[] } | null,
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
  const activeChapterIdx = chaptersWithWickets.findIndex(c => c.number === activeChapter)
  const nextChapter = chaptersWithWickets[activeChapterIdx + 1] ?? null
  const nextUnscoredWicket = activeWickets.find(w => !isAnswered(responses.get(w.event_code))) ?? null

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
      {/* Mobile nav backdrop */}
      {showMobileNav && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setShowMobileNav(false)}
        />
      )}

      {/* Left pane — chapter nav */}
      <aside className={[
        'w-72 shrink-0 border-r border-neutral-400 bg-neutral-200 overflow-y-auto flex flex-col border-t-4 border-t-scarlet',
        'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
        'lg:static lg:translate-x-0',
        showMobileNav ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <div className="px-3 pt-4 pb-3 border-b border-neutral-100 space-y-1.5">
          <div className="flex items-center justify-between">
          <Link
            to={`/assessments/${assessmentId}`}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            ← JTS Assessment
          </Link>
          <button
            onClick={() => setShowMobileNav(false)}
            className="lg:hidden p-1 text-neutral-400 hover:text-neutral-600 rounded"
            aria-label="Close navigation"
          >
            ✕
          </button>
          </div>
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
            className="block text-center text-[10px] text-neutral-400 hover:text-neutral-600 border border-neutral-400 rounded px-2 py-1 mt-1"
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
                onClick={() => { setActiveChapter(ch.number); mainRef.current?.scrollTo({ top: 0 }) }}
                className={[
                  'flex items-start gap-2 px-3 py-2 rounded text-left transition-colors border-l-2',
                  isActive
                    ? 'bg-scarlet text-white font-semibold border-scarlet'
                    : answered === total && total > 0
                    ? 'text-neutral-700 hover:bg-neutral-100 border-signal-green'
                    : answered > 0
                    ? 'text-neutral-700 hover:bg-neutral-100 border-signal-amber'
                    : 'text-neutral-600 hover:bg-neutral-100 border-transparent',
                ].join(' ')}
              >
                <span className={[
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0 border mt-0.5',
                  isActive
                    ? 'border-white/40 text-white'
                    : answered === total && total > 0
                    ? 'border-signal-green text-signal-green'
                    : answered > 0
                    ? 'border-signal-amber text-signal-amber'
                    : 'border-neutral-300 text-neutral-400',
                ].join(' ')}>
                  {ch.number}
                </span>
                <span className="flex-1 leading-snug text-xs">{ch.title}</span>
                <span className={[
                  'text-[9px] shrink-0 mt-0.5',
                  isActive ? 'text-white/70'
                  : answered === total && total > 0 ? 'text-signal-green'
                  : answered > 0 ? 'text-signal-amber'
                  : 'text-neutral-400',
                ].join(' ')}>
                  {answered}/{total}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main pane — wickets */}
      <main ref={mainRef} className="flex-1 overflow-y-auto bg-neutral-50 flex flex-col min-w-0">
        {/* Mobile-only sticky top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-400 shrink-0">
          <button
            onClick={() => setShowMobileNav(true)}
            className="p-2 -ml-2 text-neutral-600 rounded hover:bg-neutral-200 transition-colors"
            aria-label="Open navigation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-neutral-800 truncate">{assessment.unit_name}</p>
            <p className="text-[10px] text-neutral-500">T&amp;R Assessment</p>
          </div>
          {activeChapter !== null && (
            <span className="text-[10px] text-neutral-500 shrink-0">Ch. {activeChapter}</span>
          )}
        </div>

        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-6">
          {activeChapter !== null && (
            <>
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5">
                  Chapter {activeChapter} · T&R Wickets
                </p>
                <h2 className="font-display text-lg font-bold text-neutral-900">
                  {chaptersWithWickets.find(c => c.number === activeChapter)?.title ?? ''}
                </h2>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-xs text-neutral-500">
                    {chapterCounts(activeChapter).answered} of {chapterCounts(activeChapter).total} scored
                  </p>
                  {nextUnscoredWicket && (
                    <button
                      type="button"
                      onClick={() => document.getElementById(nextUnscoredWicket.event_code)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className="text-xs font-semibold px-2 py-0.5 rounded border"
                      style={{ borderColor: 'var(--signal-amber)', color: 'var(--signal-amber)', background: 'rgba(201,154,46,0.10)' }}
                    >
                      ↓ next unscored
                    </button>
                  )}
                </div>
              </div>
              {activeWickets.map(w => (
                <WicketCard
                  key={w.event_code}
                  wicket={w}
                  response={responses.get(w.event_code)}
                  evidence={jtsEvidence[w.event_code]}
                  highlighted={linkedWicket === w.event_code}
                  onSave={handleSave}
                />
              ))}

              <div className="mt-4 mb-8 flex justify-between items-center border-t border-neutral-200 pt-4">
                <span className="text-xs text-neutral-400">
                  {chapterCounts(activeChapter).answered}/{chapterCounts(activeChapter).total} wickets scored in this chapter
                </span>
                {nextChapter ? (
                  <button
                    type="button"
                    onClick={() => { setActiveChapter(nextChapter.number); mainRef.current?.scrollTo({ top: 0 }) }}
                    className="text-sm font-semibold px-4 py-2 rounded border-2 transition-colors"
                    style={{ borderColor: 'var(--signal-blue)', color: 'var(--signal-blue)', background: 'rgba(91,122,139,0.10)' }}
                  >
                    Next: {nextChapter.title} →
                  </button>
                ) : (
                  <span className="text-xs text-neutral-400 italic">Last chapter</span>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
