import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment } from '../types/assessment'
import type { TrResponse } from '../types/assessment'
import type { TrFramework, TrWicket, TrChapter } from '../types/tr'
import { MISSION_TYPE_LABELS } from '../types/assessment'

function statusSymbol(s: string | undefined) {
  switch (s) {
    case 'go':    return 'GO'
    case 'no_go': return 'NO-GO'
    case 'na':    return 'N/A'
    default:      return '○'
  }
}

function statusClass(s: string | undefined) {
  switch (s) {
    case 'go':    return 'text-green-700 font-bold'
    case 'no_go': return 'text-red-700 font-bold'
    case 'na':    return 'text-neutral-500'
    default:      return 'text-neutral-300'
  }
}

function WicketRow({
  wicket,
  response,
}: {
  wicket: TrWicket
  response: TrResponse | undefined
}) {
  const s = response?.status
  return (
    <div className="py-1 border-b border-neutral-100 last:border-0">
      <div className="flex gap-2 items-start">
        <span className={`text-xs shrink-0 w-12 text-center mt-0.5 ${statusClass(s)}`}>
          {statusSymbol(s)}
        </span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] font-mono text-neutral-400 shrink-0">{wicket.event_code}</span>
            <p className="text-[11px] text-neutral-800 leading-snug">{wicket.title}</p>
          </div>
          {wicket.mets_extracted && wicket.mets_extracted.length > 0 && (
            <p className="text-[9px] text-neutral-400 mt-0.5">
              METs: {wicket.mets_extracted.map(m => m.id).join(', ')}
            </p>
          )}
          {response?.note && (
            <p className="text-[10px] text-neutral-500 italic mt-0.5 pl-1 border-l border-neutral-200">
              {response.note}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ChapterBlock({
  chapter,
  wickets,
  responses,
}: {
  chapter: TrChapter
  wickets: TrWicket[]
  responses: Map<string, TrResponse>
}) {
  const answered = wickets.filter(w => {
    const r = responses.get(w.event_code)
    return r && r.status !== 'unanswered'
  }).length

  return (
    <div className="mb-6 break-inside-avoid-page">
      <div className="flex items-baseline justify-between mb-1 border-b-2 border-neutral-200 pb-1">
        <h2 className="text-sm font-bold text-neutral-900">
          Ch {chapter.number} — {chapter.title}
        </h2>
        <span className="text-[10px] text-neutral-400">{answered}/{wickets.length}</span>
      </div>
      {wickets.map(w => (
        <WicketRow key={w.event_code} wicket={w} response={responses.get(w.event_code)} />
      ))}
    </div>
  )
}

export function TrPrintPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [tr, setTr] = useState<TrFramework | null>(null)
  const [responses, setResponses] = useState<Map<string, TrResponse>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('Loading…')

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
      setLoadingMsg('')
    }).catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [assessmentId])

  if (error) return <div className="p-8 text-red-600 text-sm">{error}</div>
  if (loadingMsg || !assessment || !tr) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">
        {loadingMsg || 'Loading…'}
      </div>
    )
  }

  const allResponses = [...responses.values()]
  const goCount    = allResponses.filter(r => r.status === 'go').length
  const noGoCount  = allResponses.filter(r => r.status === 'no_go').length
  const naCount    = allResponses.filter(r => r.status === 'na').length
  const answered   = allResponses.filter(r => r.status !== 'unanswered').length
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const chaptersWithWickets = tr.chapters.filter(ch =>
    tr.wickets.some(w => w.chapter === ch.number)
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Print toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-neutral-800">
            {assessment.unit_name} — T&R Print Preview
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded bg-scarlet text-white text-xs font-semibold px-4 py-1.5 hover:opacity-90 transition-opacity"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 print:px-6 print:py-4">
        {/* Cover */}
        <div className="mb-8 pb-6 border-b-2 border-neutral-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
                CONTROLLED UNCLASSIFIED INFORMATION // BASIC
              </p>
              <h1 className="text-xl font-bold text-neutral-900">
                T&R Readiness Record
              </h1>
              <p className="text-sm text-neutral-600 mt-0.5">NAVMC 3500.84B — HSS T&R Manual</p>
            </div>
            <div className="text-right text-xs text-neutral-500 space-y-0.5">
              <p className="font-mono font-bold text-neutral-700">{assessment.unit_uic}</p>
              <p>{assessment.unit_name}</p>
              <p>{MISSION_TYPE_LABELS[assessment.mission_type]}</p>
              <p className="mt-1 text-neutral-400">{date}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Answered', val: answered,  cls: 'text-neutral-700' },
              { label: 'GO',       val: goCount,   cls: 'text-green-700' },
              { label: 'NO-GO',    val: noGoCount, cls: 'text-red-700' },
              { label: 'N/A',      val: naCount,   cls: 'text-neutral-500' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="border border-neutral-200 rounded py-2">
                <p className={`text-lg font-bold ${cls}`}>{val}</p>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[9px] text-neutral-400 italic">
            Unofficial — not endorsed by USMC, Navy, DHA, or JTS. Crosswalk mappings are draft and require SME review.
          </p>
        </div>

        {/* Chapters */}
        {chaptersWithWickets.map(ch => (
          <ChapterBlock
            key={ch.number}
            chapter={ch}
            wickets={tr.wickets.filter(w => w.chapter === ch.number)}
            responses={responses}
          />
        ))}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-200 text-[9px] text-neutral-400 flex justify-between">
          <span>R2RA · NAVMC 3500.84B v{tr.version}</span>
          <span>CONTROLLED UNCLASSIFIED INFORMATION // BASIC</span>
          <span>Generated {date}</span>
        </div>
      </div>
    </div>
  )
}
