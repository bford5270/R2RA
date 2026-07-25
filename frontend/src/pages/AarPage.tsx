import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment, Debrief, LoFeedback, ScenarioCase, TrResponse } from '../types/assessment'
import type { TrFramework, TrWicket } from '../types/tr'
import { MISSION_TYPE_LABELS } from '../types/assessment'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function effectiveScore(r: TrResponse | undefined): number | null {
  if (!r) return null
  const comps = r.capture_data?.components
  const scored = Array.isArray(comps) ? (comps as unknown[]).filter((s): s is number => typeof s === 'number') : []
  const auto = scored.length > 0 ? Math.min(...scored) : null
  return r.score ?? auto
}

function isGo(r: TrResponse | undefined): boolean {
  const eff = effectiveScore(r)
  return eff !== null ? eff >= 4 : r?.status === 'go'
}

function isNoGo(r: TrResponse | undefined): boolean {
  const eff = effectiveScore(r)
  return eff !== null ? eff < 4 : r?.status === 'no_go'
}

function computeTLevel(wickets: TrWicket[], responses: Map<string, TrResponse>): 'T1' | 'T2' | 'T3' | 'T4' | null {
  const rc = wickets.filter(w => w.readiness_coded)
  if (rc.length === 0) return null
  const goCount = rc.filter(w => isGo(responses.get(w.event_code))).length
  const pct = goCount / rc.length
  if (pct >= 0.9) return 'T1'
  if (pct >= 0.7) return 'T2'
  if (pct >= 0.5) return 'T3'
  return 'T4'
}

function dateRange(responses: Map<string, TrResponse>): string {
  const dates = [...responses.values()]
    .map(r => r.conducted_on)
    .filter((d): d is string => !!d)
    .sort()
  if (dates.length === 0) return '—'
  if (dates.length === 1) return dates[0]
  return `${dates[0]} – ${dates[dates.length - 1]}`
}

function maxHeadcount(responses: Map<string, TrResponse>): number | null {
  const vals = [...responses.values()].map(r => r.headcount).filter((h): h is number => h !== null)
  return vals.length > 0 ? Math.max(...vals) : null
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Non-performant',
  2: 'Significant deficiencies',
  3: 'Approaches standard',
  4: 'Meets standard',
  5: 'Exceeds standard',
}

// ---------------------------------------------------------------------------
// Text export builder
// ---------------------------------------------------------------------------

function buildAarText(
  assessment: Assessment,
  tr: TrFramework,
  responses: Map<string, TrResponse>,
  tLevel: string | null,
  narrative: string,
  priorities: string,
): string {
  const lines: string[] = []
  lines.push('AFTER ACTION REVIEW — T&R EVALUATION')
  lines.push('='.repeat(60))
  lines.push(`Unit: ${assessment.unit_name} (${assessment.unit_uic})`)
  lines.push(`Mission Type: ${MISSION_TYPE_LABELS[assessment.mission_type]}`)
  const ev = [assessment.tr_evaluator_rank, assessment.tr_evaluator_name].filter(Boolean).join(' ')
  lines.push(`Evaluator: ${ev || '—'}${assessment.tr_evaluator_billet ? `, ${assessment.tr_evaluator_billet}` : ''}`)
  lines.push(`Date(s) of Training: ${dateRange(responses)}`)
  const hc = maxHeadcount(responses)
  lines.push(`Personnel Assessed: ${hc ?? '—'}`)
  lines.push(`T-Level Determination: ${tLevel ?? '—'}`)
  lines.push('')
  lines.push('SCALE: 1=Non-performant | 2=Significant deficiencies | 3=Approaches standard')
  lines.push('       4=Meets standard | 5=Exceeds standard')
  lines.push('')

  const allWickets = tr.wickets
  const goWickets = allWickets.filter(w => isGo(responses.get(w.event_code)))
  const noGoWickets = allWickets.filter(w => isNoGo(responses.get(w.event_code)))

  lines.push(`SUSTAINS (GO Events — ${goWickets.length} of ${allWickets.length} wickets)`)
  lines.push('─'.repeat(60))
  for (const ch of tr.chapters) {
    const chGo = goWickets.filter(w => w.chapter === ch.number)
    if (chGo.length === 0) continue
    lines.push(`\n  Chapter ${ch.number} — ${ch.title}`)
    for (const w of chGo) {
      const r = responses.get(w.event_code)
      const eff = effectiveScore(r)
      lines.push(`  • ${w.event_code} — ${w.title}${eff ? ` (Score: ${eff}/5)` : ''}`)
      const s = r?.capture_data?.sustains
      if (s) lines.push(`    ${s}`)
    }
  }
  lines.push('')

  lines.push(`IMPROVES (NO-GO Events — ${noGoWickets.length} of ${allWickets.length} wickets)`)
  lines.push('─'.repeat(60))
  for (const ch of tr.chapters) {
    const chNoGo = noGoWickets.filter(w => w.chapter === ch.number)
    if (chNoGo.length === 0) continue
    lines.push(`\n  Chapter ${ch.number} — ${ch.title}`)
    for (const w of chNoGo) {
      const r = responses.get(w.event_code)
      const eff = effectiveScore(r)
      const cd = r?.capture_data
      lines.push(`  • ${w.event_code} — ${w.title}${eff ? ` (Score: ${eff}/5)` : ''}`)
      if (cd?.improves) lines.push(`    Deficiency: ${cd.improves}`)
      if (cd?.corrective_action) lines.push(`    Corrective Action: ${cd.corrective_action}`)
      if (cd?.corrective_action_suspense) lines.push(`    Suspense: ${cd.corrective_action_suspense}`)
      if (cd?.corrective_action_owner) lines.push(`    Owner: ${cd.corrective_action_owner}`)
    }
  }
  lines.push('')

  lines.push("COMMANDER'S ASSESSMENT")
  lines.push('─'.repeat(60))
  lines.push(narrative || '(not yet entered)')
  lines.push('')

  lines.push('TRAINING PRIORITIES')
  lines.push('─'.repeat(60))
  lines.push(priorities || '(not yet entered)')
  lines.push('')

  lines.push('DISTRIBUTION: DoD COMMUNITY ONLY')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AarPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [tr, setTr] = useState<TrFramework | null>(null)
  const [responses, setResponses] = useState<Map<string, TrResponse>>(new Map())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [narrative, setNarrative] = useState('')
  const [priorities, setPriorities] = useState('')
  const [loFeedback, setLoFeedback] = useState<LoFeedback[]>([])
  const [cases, setCases] = useState<ScenarioCase[]>([])
  const [debriefs, setDebriefs] = useState<Debrief[]>([])
  const [copied, setCopied] = useState(false)
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([
      api.getAssessment(assessmentId),
      api.getTrFramework(),
      api.listTrResponses(assessmentId),
      api.listLoFeedback(assessmentId).catch(() => [] as LoFeedback[]),
      api.listCases(assessmentId).catch(() => [] as ScenarioCase[]),
      api.listDebriefs(assessmentId).catch(() => [] as Debrief[]),
    ]).then(([a, framework, rs, fb, cs, ds]) => {
      setAssessment(a)
      setNarrative(a.tr_aar_narrative ?? '')
      setPriorities(a.tr_aar_priorities ?? '')
      setTr(framework)
      setResponses(new Map(rs.map(r => [r.event_code, r])))
      setLoFeedback(fb)
      setCases(cs)
      setDebriefs(ds.filter(d => d.status === 'committed'))
    }).catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load'))
  }, [assessmentId])

  const saveMeta = useCallback((nar: string, pri: string) => {
    if (!assessmentId) return
    if (metaTimer.current) clearTimeout(metaTimer.current)
    metaTimer.current = setTimeout(() => {
      api.updateTrMeta(assessmentId, {
        tr_aar_narrative: nar || null,
        tr_aar_priorities: pri || null,
      })
    }, 800)
  }, [assessmentId])

  if (loadError) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-red-600">{loadError}</div>
  }
  if (!assessment || !tr) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">Loading…</div>
  }

  const allWickets = tr.wickets
  const goWickets = allWickets.filter(w => isGo(responses.get(w.event_code)))
  const noGoWickets = allWickets.filter(w => isNoGo(responses.get(w.event_code)))
  const tLevel = computeTLevel(allWickets, responses)
  const hc = maxHeadcount(responses)
  const ev = [assessment.tr_evaluator_rank, assessment.tr_evaluator_name].filter(Boolean).join(' ')

  const tLevelStyle =
    tLevel === 'T1' || tLevel === 'T2'
      ? 'text-green-700 bg-green-50 border-green-400'
      : tLevel === 'T3'
      ? 'text-amber-700 bg-amber-50 border-amber-400'
      : 'text-red-700 bg-red-50 border-red-400'

  const textareaBase = 'w-full rounded border px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-1 resize-none border-neutral-300 focus:ring-amber-500/40 print:border-0 print:p-0 print:resize-none'

  function handleCopy() {
    const text = buildAarText(assessment!, tr!, responses, tLevel, narrative, priorities)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      {/* Top bar — hidden in print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-300 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link
          to={`/assessments/${assessmentId}/tr`}
          className="text-xs text-neutral-400 hover:text-neutral-600 shrink-0"
        >
          ← T&R Assessment
        </Link>
        <span className="text-sm font-bold text-neutral-800 flex-1 truncate">
          AAR — {assessment.unit_name}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded border border-neutral-300 text-neutral-600 hover:border-neutral-500 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy for MCTIMS'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="text-xs px-3 py-1.5 rounded border border-neutral-400 bg-neutral-700 text-white hover:bg-neutral-800 transition-colors"
          >
            Print / PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header block */}
        <div className="border border-neutral-300 rounded-lg p-5 bg-white print:border-0 print:p-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">After Action Review — T&amp;R Evaluation</p>
          <h1 className="text-xl font-bold text-neutral-900 mb-3">{assessment.unit_name}</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-[11px] text-neutral-700">
            <div><span className="text-neutral-400">UIC:</span> {assessment.unit_uic}</div>
            <div><span className="text-neutral-400">Mission:</span> {MISSION_TYPE_LABELS[assessment.mission_type]}</div>
            <div>
              <span className="text-neutral-400">T-Level:</span>{' '}
              {tLevel
                ? <span className={`font-black px-1.5 py-0.5 rounded border text-sm ${tLevelStyle}`}>{tLevel}</span>
                : <span className="text-neutral-300">—</span>}
            </div>
            <div><span className="text-neutral-400">Evaluator:</span> {ev || '—'}{assessment.tr_evaluator_billet ? `, ${assessment.tr_evaluator_billet}` : ''}</div>
            <div><span className="text-neutral-400">Date(s):</span> {dateRange(responses)}</div>
            <div><span className="text-neutral-400">Personnel:</span> {hc ?? '—'}</div>
          </div>
          <div className="mt-3 text-[10px] text-neutral-400">
            SCALE: 1=Non-performant · 2=Significant deficiencies · 3=Approaches standard · 4=Meets standard · 5=Exceeds standard
          </div>
        </div>

        {/* Sustains */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--signal-green)' }}>
              Sustains
            </h2>
            <span className="text-xs text-neutral-400">GO Events — {goWickets.length} of {allWickets.length} wickets</span>
          </div>
          <div className="border-l-4 pl-4 space-y-4" style={{ borderColor: 'var(--signal-green)' }}>
            {goWickets.length === 0 && (
              <p className="text-xs text-neutral-400 italic">No events scored GO yet.</p>
            )}
            {tr.chapters.map(ch => {
              const chGo = goWickets.filter(w => w.chapter === ch.number)
              if (chGo.length === 0) return null
              return (
                <div key={ch.number}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">
                    Ch. {ch.number} — {ch.title}
                  </p>
                  <div className="space-y-2">
                    {chGo.map(w => {
                      const r = responses.get(w.event_code)
                      const eff = effectiveScore(r)
                      return (
                        <div key={w.event_code} className="text-sm">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[10px] text-neutral-400 shrink-0">{w.event_code}</span>
                            <span className="font-semibold text-neutral-800">{w.title}</span>
                            {eff !== null && (
                              <span className="text-[10px] text-neutral-400 shrink-0">Score: {eff}/5 — {SCORE_LABELS[eff]}</span>
                            )}
                          </div>
                          {r?.capture_data?.sustains && (
                            <p className="text-xs text-neutral-600 mt-0.5 pl-4">{r.capture_data.sustains as string}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Improves */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--signal-red)' }}>
              Improves
            </h2>
            <span className="text-xs text-neutral-400">NO-GO Events — {noGoWickets.length} of {allWickets.length} wickets</span>
          </div>
          <div className="border-l-4 pl-4 space-y-4" style={{ borderColor: 'var(--signal-red)' }}>
            {noGoWickets.length === 0 && (
              <p className="text-xs text-neutral-400 italic">No events scored NO-GO yet.</p>
            )}
            {tr.chapters.map(ch => {
              const chNoGo = noGoWickets.filter(w => w.chapter === ch.number)
              if (chNoGo.length === 0) return null
              return (
                <div key={ch.number}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mb-1.5">
                    Ch. {ch.number} — {ch.title}
                  </p>
                  <div className="space-y-4">
                    {chNoGo.map(w => {
                      const r = responses.get(w.event_code)
                      const eff = effectiveScore(r)
                      const cd = r?.capture_data
                      return (
                        <div key={w.event_code} className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-mono text-[10px] text-neutral-400 shrink-0">{w.event_code}</span>
                            <span className="text-sm font-semibold text-neutral-800">{w.title}</span>
                            {eff !== null && (
                              <span className="text-[10px] text-neutral-400 shrink-0">Score: {eff}/5</span>
                            )}
                          </div>
                          {cd?.improves && (
                            <div className="mt-1">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">Deficiency: </span>
                              <span className="text-xs text-neutral-700">{cd.improves as string}</span>
                            </div>
                          )}
                          {cd?.corrective_action && (
                            <div className="mt-1">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">Corrective Action: </span>
                              <span className="text-xs text-neutral-700">{cd.corrective_action as string}</span>
                            </div>
                          )}
                          {(cd?.corrective_action_suspense || cd?.corrective_action_owner) && (
                            <div className="flex gap-4 mt-1">
                              {cd?.corrective_action_suspense && (
                                <span className="text-[10px] text-neutral-500">
                                  <span className="font-semibold">Suspense:</span> {cd.corrective_action_suspense as string}
                                </span>
                              )}
                              {cd?.corrective_action_owner && (
                                <span className="text-[10px] text-neutral-500">
                                  <span className="font-semibold">Owner:</span> {cd.corrective_action_owner as string}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Learning objective feedback — rolled up from evaluators */}
        {loFeedback.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">
              Learning Objective Feedback
            </h2>
            {cases.length > 0 && (
              <p className="text-[11px] text-neutral-500 mb-2">
                Scenario case{cases.length === 1 ? '' : 's'}: {cases.map(c => c.label).join(' · ')}
              </p>
            )}
            <div className="space-y-2">
              {[...new Set(loFeedback.map(f => f.event_code))].sort().map(code => {
                const wicket = tr.wickets.find(w => w.event_code === code)
                const entries = loFeedback.filter(f => f.event_code === code)
                return (
                  <div key={code} className="border border-neutral-300 rounded p-3 bg-white break-inside-avoid-page">
                    <p className="text-xs font-mono font-bold text-neutral-700">
                      {code}
                      {wicket && <span className="font-sans font-normal text-neutral-500"> — {wicket.title}</span>}
                    </p>
                    {entries.map(f => {
                      const linkedCase = f.case_id ? cases.find(c => c.id === f.case_id) : null
                      return (
                        <div key={f.id} className="mt-1.5 text-xs text-neutral-600">
                          <span className="font-semibold">{f.author_name}</span>
                          {f.rating !== null && <> · LO support {f.rating}/5</>}
                          {f.recommendation && (
                            <>
                              {' · '}
                              <span
                                className="font-bold uppercase"
                                style={{
                                  color:
                                    f.recommendation === 'keep'
                                      ? 'var(--signal-green)'
                                      : f.recommendation === 'change'
                                      ? 'var(--signal-amber)'
                                      : 'var(--signal-red)',
                                }}
                              >
                                {f.recommendation}
                              </span>
                            </>
                          )}
                          {linkedCase && <> · case: {linkedCase.label}</>}
                          {f.comment && <p className="italic mt-0.5">“{f.comment}”</p>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Committed team debriefs — AI-distilled, lead-reviewed */}
        {debriefs.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">
              Team Debrief{debriefs.length > 1 ? 's' : ''}
            </h2>
            {debriefs.map(d => (
              <div key={d.id} className="border border-neutral-300 rounded p-3 bg-white mb-2 break-inside-avoid-page">
                <p className="text-xs font-semibold text-neutral-700">
                  {d.title}
                  <span className="font-normal text-neutral-400"> · {new Date(d.created_at).toLocaleDateString()}</span>
                </p>
                {d.distilled?.summary && (
                  <p className="text-xs italic text-neutral-600 mt-1">{d.distilled.summary}</p>
                )}
                {([
                  ['Sustains', d.distilled?.sustains, 'var(--signal-green)'],
                  ['Opportunities for growth', d.distilled?.improves, 'var(--signal-amber)'],
                  ['For next time', d.distilled?.next_time, 'var(--signal-blue)'],
                ] as const).map(([label, items, color]) =>
                  items && items.length > 0 ? (
                    <div key={label} className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>{label}</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {items.map((it, i) => (
                          <li key={i} className="text-xs text-neutral-600 flex gap-1.5">
                            <span style={{ color }}>•</span>
                            <span>
                              {it.text}
                              {it.event_codes.length > 0 && (
                                <span className="font-mono text-[10px] text-neutral-400"> [{it.event_codes.join(', ')}]</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            ))}
          </section>
        )}

        {/* Commander's Assessment — editable */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">Commander's Assessment</h2>
          <textarea
            rows={6}
            value={narrative}
            onChange={e => { setNarrative(e.target.value); saveMeta(e.target.value, priorities) }}
            placeholder="Enter commander's assessment narrative…"
            className={`${textareaBase} print:min-h-[80px]`}
          />
        </section>

        {/* Training Priorities — editable */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">Training Priorities</h2>
          <textarea
            rows={4}
            value={priorities}
            onChange={e => { setPriorities(e.target.value); saveMeta(narrative, e.target.value) }}
            placeholder="Enter training priorities for the next period…"
            className={`${textareaBase} print:min-h-[60px]`}
          />
        </section>

        <p className="text-[10px] text-neutral-400 text-center print:mt-8">
          DISTRIBUTION: DoD COMMUNITY ONLY
        </p>
      </div>
    </div>
  )
}
