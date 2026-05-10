import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment, ItemResponse, SignatureOut, TrResponse } from '../types/assessment'
import type { TrFramework } from '../types/tr'
import type { Manifest, SectionManifestEntry } from '@/types/content'
import { MISSION_TYPE_LABELS } from '../types/assessment'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNER_ROLE_LABELS: Record<string, string> = {
  lead_assessor: 'Lead Assessor / Certifier',
  tmd:           'TMD Representative',
  unit_oic:      'Unit OIC / SMO',
  arst_chief:    'ARST Chief',
}

function effectiveTrScore(r: TrResponse): number | null {
  const comps = r.capture_data?.components
  const scored = Array.isArray(comps) ? comps.filter((s): s is number => s !== null) : []
  const auto = scored.length > 0 ? Math.min(...scored) : null
  return r.score ?? auto
}

function effectiveTrStatus(r: TrResponse): 'go' | 'no_go' | 'na' | 'unanswered' {
  if (r.status === 'na') return 'na'
  const sc = effectiveTrScore(r)
  if (sc !== null) return sc >= 4 ? 'go' : 'no_go'
  return r.status
}

function isSectionVisible(entry: SectionManifestEntry, missionType: string): boolean {
  if (!entry.visible_when) return true
  const mt = entry.visible_when.mission_type
  return !mt || mt === missionType
}

function jtsPrefix(itemId: string) { return itemId.split('.')[0] }

// Score → color utilities
function scoreColor(score: number | null) {
  if (score === null) return { bg: 'bg-neutral-100', text: 'text-neutral-400', border: 'border-neutral-200', label: 'Not scored' }
  if (score >= 4) return { bg: 'bg-green-50',    text: 'text-green-800',   border: 'border-green-300',   label: score >= 5 ? 'Exceeds standard' : 'Meets standard' }
  if (score === 3) return { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-300',   label: 'Approaches standard' }
  return             { bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-300',     label: score === 2 ? 'Significant deficiencies' : 'Non-performant' }
}

function jtsStatusColor(pct: number) {
  if (pct >= 0.8) return 'bg-green-500'
  if (pct >= 0.5) return 'bg-amber-400'
  return 'bg-red-500'
}

// ---------------------------------------------------------------------------
// Chapter score card
// ---------------------------------------------------------------------------

function ChapterCard({
  chapterNum,
  title,
  wickets,
  responses,
}: {
  chapterNum: number
  title: string
  wickets: { event_code: string; title: string }[]
  responses: Map<string, TrResponse>
}) {
  const answered = wickets.filter(w => {
    const r = responses.get(w.event_code)
    return r && effectiveTrStatus(r) !== 'unanswered'
  })
  const scores = answered
    .map(w => effectiveTrScore(responses.get(w.event_code)!))
    .filter((s): s is number => s !== null)

  const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const minScore  = scores.length > 0 ? Math.min(...scores) : null
  const goCount   = answered.filter(w => effectiveTrStatus(responses.get(w.event_code)!) === 'go').length
  const noGoCount = answered.filter(w => effectiveTrStatus(responses.get(w.event_code)!) === 'no_go').length

  const displayScore = minScore  // weakest-link for chapter summary
  const { bg, text, border, label } = scoreColor(displayScore)

  if (answered.length === 0) return null

  return (
    <div className={`rounded-lg border ${border} ${bg} p-4 break-inside-avoid-page`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Chapter {chapterNum}</p>
          <p className="text-sm font-semibold text-neutral-800 leading-snug">{title}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          {displayScore !== null && (
            <p className={`text-2xl font-black ${text}`}>{displayScore}<span className="text-sm font-normal">/5</span></p>
          )}
          <p className={`text-[10px] font-semibold ${text}`}>{label}</p>
        </div>
      </div>
      <div className="flex gap-3 text-[11px] text-neutral-500 mt-1">
        <span>{answered.length}/{wickets.length} wickets evaluated</span>
        <span className="text-green-700 font-semibold">{goCount} GO</span>
        <span className="text-red-700 font-semibold">{noGoCount} NO-GO</span>
        {meanScore !== null && <span className="ml-auto">Mean: {meanScore.toFixed(1)}/5</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JTS section row
// ---------------------------------------------------------------------------

function JtsSectionRow({ title, responses }: { title: string; responses: ItemResponse[] }) {
  if (responses.length === 0) return null
  const yes = responses.filter(r => r.status === 'yes').length
  const no  = responses.filter(r => r.status === 'no').length
  const na  = responses.filter(r => r.status === 'na').length
  const pct = responses.length > 0 ? yes / responses.length : 0
  const barColor = jtsStatusColor(pct)

  return (
    <div className="py-2.5 border-b border-neutral-100 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-neutral-700 font-medium leading-snug">{title}</p>
        <div className="flex gap-2 text-[11px] shrink-0 ml-3">
          <span className="text-green-700 font-bold">{yes} YES</span>
          <span className="text-red-600 font-bold">{no} NO</span>
          {na > 0 && <span className="text-neutral-400">{na} N/A</span>}
        </div>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Findings list
// ---------------------------------------------------------------------------

function FindingRow({ status, label, note }: { status: string; label: string; note: string }) {
  const isStrength = status === 'go' || status === 'yes'
  return (
    <div className={`pl-3 border-l-2 mb-2 ${isStrength ? 'border-green-400' : 'border-red-400'}`}>
      <p className="text-[11px] font-semibold text-neutral-700">{label}</p>
      <p className="text-[11px] text-neutral-500 leading-snug">{note}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function FeedbackPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()

  const [assessment, setAssessment]     = useState<Assessment | null>(null)
  const [manifest, setManifest]         = useState<Manifest | null>(null)
  const [jtsResponses, setJtsResponses] = useState<Map<string, ItemResponse>>(new Map())
  const [trFramework, setTrFramework]   = useState<TrFramework | null>(null)
  const [trResponses, setTrResponses]   = useState<Map<string, TrResponse>>(new Map())
  const [signatures, setSignatures]     = useState<SignatureOut[]>([])
  const [error, setError]               = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([
      api.getAssessment(assessmentId),
      api.manifest(),
      api.listResponses(assessmentId),
      api.getTrFramework(),
      api.listTrResponses(assessmentId),
      api.listSignatures(assessmentId),
    ]).then(([a, m, jrs, tf, trs, sigs]) => {
      setAssessment(a as Assessment)
      setManifest(m as unknown as Manifest)
      setJtsResponses(new Map((jrs as ItemResponse[]).map(r => [r.item_id, r])))
      setTrFramework(tf as TrFramework)
      setTrResponses(new Map((trs as TrResponse[]).map(r => [r.event_code, r])))
      setSignatures(sigs as SignatureOut[])
    }).catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [assessmentId])

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">Loading…</div>
  if (error || !assessment || !manifest || !trFramework) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-red-600">{error ?? 'Failed to load'}</div>
  }

  const date = new Date(assessment.certified_at ?? assessment.started_at)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const visibleSections = (manifest as Manifest).sections_manifest.filter(
    s => isSectionVisible(s, assessment.mission_type)
  )

  const chaptersWithWickets = trFramework.chapters.filter(ch =>
    trFramework.wickets.some(w => w.chapter === ch.number)
  )

  // Overall T&R status
  const allTrAnswered = [...trResponses.values()].filter(r => effectiveTrStatus(r) !== 'unanswered')
  const allScores     = allTrAnswered.map(r => effectiveTrScore(r)).filter((s): s is number => s !== null)
  const overallMean   = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null
  const overallMin    = allScores.length > 0 ? Math.min(...allScores) : null
  const trGoCount     = allTrAnswered.filter(r => effectiveTrStatus(r) === 'go').length
  const trNoGoCount   = allTrAnswered.filter(r => effectiveTrStatus(r) === 'no_go').length

  // Overall readiness determination
  const overallStatus =
    trNoGoCount === 0 && allTrAnswered.length > 0 ? 'FULLY MISSION CAPABLE' :
    trNoGoCount <= 2 ? 'SUBSTANTIALLY MISSION CAPABLE' :
    trNoGoCount > 2  ? 'NOT FULLY MISSION CAPABLE' : 'ASSESSMENT INCOMPLETE'

  const statusColor =
    overallStatus === 'FULLY MISSION CAPABLE'         ? 'bg-green-700 text-white' :
    overallStatus === 'SUBSTANTIALLY MISSION CAPABLE' ? 'bg-amber-500 text-white' :
    overallStatus === 'NOT FULLY MISSION CAPABLE'     ? 'bg-red-700 text-white' :
                                                        'bg-neutral-400 text-white'

  // Findings — items with notes
  const trStrengths = trFramework.wickets
    .map(w => ({ w, r: trResponses.get(w.event_code) }))
    .filter(({ r }) => r?.note && effectiveTrStatus(r) === 'go')
  const trDeficiencies = trFramework.wickets
    .map(w => ({ w, r: trResponses.get(w.event_code) }))
    .filter(({ r }) => r?.note && effectiveTrStatus(r) === 'no_go')

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="text-xs text-neutral-500 hover:text-neutral-700">
            ← Back
          </button>
          <span className="text-sm font-semibold text-neutral-800">
            {assessment.unit_name} — Unit Feedback Report
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded bg-scarlet text-white text-xs font-semibold px-4 py-1.5 hover:opacity-90"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8 print:px-6 print:py-4">

        {/* Header */}
        <div className="mb-6 pb-5 border-b-2 border-neutral-200">
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
            CONTROLLED UNCLASSIFIED INFORMATION // BASIC
          </p>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-neutral-900">Assessment Feedback Report</h1>
              <p className="text-sm text-neutral-500 mt-0.5">Role 2 Readiness Assessment · JTS Form + NAVMC 3500.84B</p>
            </div>
            <div className="text-right text-xs text-neutral-500 space-y-0.5">
              <p className="font-mono font-bold text-base text-neutral-800">{assessment.unit_uic}</p>
              <p className="font-semibold text-neutral-700">{assessment.unit_name}</p>
              <p>{MISSION_TYPE_LABELS[assessment.mission_type]}</p>
              {assessment.scenario_ref && (
                <p className="text-neutral-500">Scenario: {assessment.scenario_ref}</p>
              )}
              <p className="text-neutral-400">{date}</p>
            </div>
          </div>
        </div>

        {/* Overall status banner */}
        <div className={`rounded-xl px-6 py-4 mb-6 ${statusColor} flex items-center justify-between`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Overall Assessment</p>
            <p className="text-xl font-black mt-0.5">{overallStatus}</p>
          </div>
          {overallMean !== null && (
            <div className="text-right">
              <p className="text-3xl font-black">{overallMean.toFixed(1)}<span className="text-lg font-normal">/5</span></p>
              <p className="text-[10px] opacity-70">Mean T&R Score · Min: {overallMin}/5</p>
            </div>
          )}
        </div>

        {/* T&R score summary counts */}
        {allTrAnswered.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Wickets Evaluated', val: allTrAnswered.length, cls: 'text-neutral-700' },
              { label: 'GO',    val: trGoCount,   cls: 'text-green-700' },
              { label: 'NO-GO', val: trNoGoCount, cls: 'text-red-700' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="border border-neutral-200 rounded-lg py-3 text-center">
                <p className={`text-2xl font-black ${cls}`}>{val}</p>
                <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* T&R chapter cards */}
        {allTrAnswered.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
              T&R Assessment by Chapter — NAVMC 3500.84B
            </p>
            <div className="grid grid-cols-1 gap-3">
              {chaptersWithWickets.map(ch => (
                <ChapterCard
                  key={ch.number}
                  chapterNum={ch.number}
                  title={ch.title}
                  wickets={trFramework.wickets.filter(w => w.chapter === ch.number)}
                  responses={trResponses}
                />
              ))}
            </div>
          </div>
        )}

        {/* JTS section results */}
        <div className="mb-6 break-inside-avoid-page">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
            JTS Role 2 Readiness Checklist Results
          </p>
          <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 px-4">
            {visibleSections.map(sec => {
              const prefix = sec.item_prefix
              if (!prefix) return null
              const sectionResponses = [...jtsResponses.entries()]
                .filter(([id, r]) => jtsPrefix(id) === prefix && r.status !== 'unanswered')
                .map(([, r]) => r)
              return (
                <JtsSectionRow
                  key={sec.id}
                  title={sec.title}
                  responses={sectionResponses}
                />
              )
            })}
          </div>
        </div>

        {/* Findings */}
        {(trStrengths.length > 0 || trDeficiencies.length > 0) && (
          <div className="mb-6 break-inside-avoid-page">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">
              Assessor Findings
            </p>

            {trStrengths.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-green-700 mb-2">Strengths</p>
                {trStrengths.map(({ w, r }) => (
                  <FindingRow key={w.event_code} status="go" label={`${w.event_code} — ${w.title}`} note={r!.note!} />
                ))}
              </div>
            )}

            {trDeficiencies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-2">Areas Requiring Improvement</p>
                {trDeficiencies.map(({ w, r }) => (
                  <FindingRow key={w.event_code} status="no_go" label={`${w.event_code} — ${w.title}`} note={r!.note!} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Signature block */}
        <div className="mt-8 pt-5 border-t-2 border-neutral-200 break-inside-avoid-page">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">Assessor Certification</p>
          {signatures.length > 0 ? (
            <div className="space-y-2">
              {signatures.map(sig => (
                <div key={sig.id} className="flex items-start justify-between text-xs">
                  <div>
                    <p className="font-bold text-neutral-800">{sig.print_name}</p>
                    <p className="text-neutral-500">{SIGNER_ROLE_LABELS[sig.role] ?? sig.role}</p>
                  </div>
                  <p className="text-neutral-400">
                    {new Date(sig.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {['Lead Assessor / Certifier', 'TMD Representative'].map(role => (
                <div key={role} className="flex items-end justify-between">
                  <div className="flex-1 border-b border-neutral-300 mr-8" style={{ height: 28 }} />
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-neutral-500">{role}</p>
                    <div className="border-b border-neutral-300 w-32 mt-3" />
                    <p className="text-[10px] text-neutral-400 mt-0.5">Date</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-[9px] text-neutral-400 text-center">
          Unofficial — not endorsed by USMC, Navy, DHA, or JTS · CUI // BASIC ·
          Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  )
}
