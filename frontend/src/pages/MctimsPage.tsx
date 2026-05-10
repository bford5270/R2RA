import { useEffect, useRef, useState } from 'react'
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

function effectiveTrStatus(r: TrResponse): 'go' | 'no_go' | 'na' | 'unanswered' {
  if (r.status === 'na') return 'na'
  const comps = r.capture_data?.components
  const scored = Array.isArray(comps) ? comps.filter((s): s is number => s !== null) : []
  const auto = scored.length > 0 ? Math.min(...scored) : null
  const eff = r.score ?? auto
  if (eff !== null) return eff >= 4 ? 'go' : 'no_go'
  return r.status
}

function effectiveTrScore(r: TrResponse): number | null {
  const comps = r.capture_data?.components
  const scored = Array.isArray(comps) ? comps.filter((s): s is number => s !== null) : []
  const auto = scored.length > 0 ? Math.min(...scored) : null
  return r.score ?? auto
}

function isSectionVisible(entry: SectionManifestEntry, missionType: string): boolean {
  if (!entry.visible_when) return true
  const mt = entry.visible_when.mission_type
  return !mt || mt === missionType
}

function jtsPrefix(itemId: string) {
  return itemId.split('.')[0]
}

// ---------------------------------------------------------------------------
// CopyBlock — textarea that selects on focus + a copy button
// ---------------------------------------------------------------------------

function CopyBlock({ label, text }: { label: string; text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{label}</p>
        <button
          onClick={handleCopy}
          className={[
            'text-[11px] font-semibold px-3 py-1 rounded border transition-colors',
            copied
              ? 'border-green-400 bg-green-50 text-green-700'
              : 'border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700',
          ].join(' ')}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <textarea
        ref={ref}
        readOnly
        value={text}
        onFocus={() => ref.current?.select()}
        rows={Math.min(Math.max(text.split('\n').length + 1, 4), 20)}
        className="w-full rounded border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-mono text-neutral-700 focus:outline-none focus:ring-1 focus:ring-scarlet/40 resize-none leading-relaxed"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MctimsPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()

  const [assessment, setAssessment]   = useState<Assessment | null>(null)
  const [manifest, setManifest]       = useState<Manifest | null>(null)
  const [jtsResponses, setJtsResponses] = useState<Map<string, ItemResponse>>(new Map())
  const [trFramework, setTrFramework] = useState<TrFramework | null>(null)
  const [trResponses, setTrResponses] = useState<Map<string, TrResponse>>(new Map())
  const [signatures, setSignatures]   = useState<SignatureOut[]>([])
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [allCopied, setAllCopied]     = useState(false)

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
      setManifest(m as Manifest)
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

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const assessmentDate = new Date(assessment.started_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const certDate = assessment.certified_at
    ? new Date(assessment.certified_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const visibleSections = (manifest as Manifest).sections_manifest.filter(
    s => isSectionVisible(s, assessment.mission_type)
  )

  // ---------------------------------------------------------------------------
  // Build text blocks
  // ---------------------------------------------------------------------------

  // 1. Header block
  const headerText = [
    `UNIT: ${assessment.unit_name} (${assessment.unit_uic})`,
    `MISSION TYPE: ${MISSION_TYPE_LABELS[assessment.mission_type]}`,
    assessment.scenario_ref ? `SCENARIO: ${assessment.scenario_ref}` : '',
    `ASSESSMENT STARTED: ${assessmentDate}`,
    certDate ? `CERTIFIED: ${certDate}` : `STATUS: ${assessment.status.replace('_', ' ').toUpperCase()}`,
    `T&R FRAMEWORK: NAVMC 3500.84B (HSS T&R Manual)`,
    signatures.length > 0
      ? `ASSESSOR(S): ${signatures.map(s => `${s.print_name ?? 'Unknown'} (${SIGNER_ROLE_LABELS[s.role] ?? s.role})`).join('; ')}`
      : '',
  ].filter(Boolean).join('\n')

  // 2. T&R block — per chapter, answered wickets only
  const chaptersWithWickets = trFramework.chapters.filter(ch =>
    trFramework.wickets.some(w => w.chapter === ch.number)
  )

  const trLines: string[] = ['T&R ASSESSMENT RESULTS — NAVMC 3500.84B', '='.repeat(48)]
  let anyTrAnswered = false

  for (const ch of chaptersWithWickets) {
    const wickets = trFramework.wickets.filter(w => w.chapter === ch.number)
    const answeredWickets = wickets.filter(w => {
      const r = trResponses.get(w.event_code)
      return r && effectiveTrStatus(r) !== 'unanswered'
    })
    if (answeredWickets.length === 0) continue
    anyTrAnswered = true

    trLines.push('')
    trLines.push(`Chapter ${ch.number} — ${ch.title}`)
    trLines.push('-'.repeat(40))

    const goCount   = answeredWickets.filter(w => effectiveTrStatus(trResponses.get(w.event_code)!) === 'go').length
    const noGoCount = answeredWickets.filter(w => effectiveTrStatus(trResponses.get(w.event_code)!) === 'no_go').length
    trLines.push(`Evaluated: ${answeredWickets.length} wickets | GO: ${goCount} | NO-GO: ${noGoCount}`)
    trLines.push('')

    for (const w of answeredWickets) {
      const r = trResponses.get(w.event_code)!
      const st = effectiveTrStatus(r)
      const sc = effectiveTrScore(r)
      const statusStr = st === 'go' ? 'GO' : st === 'no_go' ? 'NO-GO' : 'N/A'
      const scoreStr = sc !== null ? ` (${sc}/5)` : ''
      trLines.push(`${w.event_code} | ${statusStr}${scoreStr}`)
      trLines.push(`  ${w.title}`)
      if (r.note) trLines.push(`  Assessor note: ${r.note}`)
    }
  }

  const trText = anyTrAnswered ? trLines.join('\n') : 'No T&R wickets have been scored yet.'

  // 3. JTS block — per visible section, answered items only
  const jtsLines: string[] = ['JTS ROLE 2 READINESS ASSESSMENT RESULTS', '='.repeat(48)]
  let anyJtsAnswered = false

  for (const sec of visibleSections) {
    const prefix = sec.item_prefix
    if (!prefix) continue
    const sectionResponses = [...jtsResponses.entries()].filter(
      ([id, r]) => jtsPrefix(id) === prefix && r.status !== 'unanswered'
    )
    if (sectionResponses.length === 0) continue
    anyJtsAnswered = true

    const yesCount = sectionResponses.filter(([, r]) => r.status === 'yes').length
    const noCount  = sectionResponses.filter(([, r]) => r.status === 'no').length
    const naCount  = sectionResponses.filter(([, r]) => r.status === 'na').length

    jtsLines.push('')
    jtsLines.push(`${sec.title}`)
    jtsLines.push('-'.repeat(40))
    jtsLines.push(`Answered: ${sectionResponses.length} | YES: ${yesCount} | NO: ${noCount} | N/A: ${naCount}`)
    jtsLines.push('')

    for (const [id, r] of sectionResponses.sort((a, b) => a[0].localeCompare(b[0]))) {
      const statusStr = r.status === 'yes' ? 'YES' : r.status === 'no' ? 'NO' : 'N/A'
      jtsLines.push(`  ${id}: ${statusStr}`)
      if (r.note) jtsLines.push(`    Note: ${r.note}`)
    }
  }

  const jtsText = anyJtsAnswered ? jtsLines.join('\n') : 'No JTS items have been answered yet.'

  // 4. Compiled findings — all notes together
  const findingLines: string[] = ['ASSESSOR FINDINGS — COMPILED NOTES', '='.repeat(48), '']

  const trNotes = trFramework.wickets
    .map(w => ({ w, r: trResponses.get(w.event_code) }))
    .filter(({ r }) => r?.note)
  if (trNotes.length > 0) {
    findingLines.push('T&R Observations:')
    for (const { w, r } of trNotes) {
      const st = effectiveTrStatus(r!)
      findingLines.push(`  [${st === 'go' ? 'GO' : st === 'no_go' ? 'NO-GO' : 'N/A'}] ${w.event_code} — ${w.title}`)
      findingLines.push(`  ${r!.note}`)
      findingLines.push('')
    }
  }

  const jtsNotes = [...jtsResponses.entries()].filter(([, r]) => r.note)
  if (jtsNotes.length > 0) {
    findingLines.push('JTS Item Observations:')
    for (const [id, r] of jtsNotes) {
      findingLines.push(`  [${r.status.toUpperCase()}] ${id}: ${r.note}`)
    }
  }

  const findingsText = findingLines.join('\n')

  // 5. Full document for "Copy All"
  const fullDoc = [headerText, '', trText, '', jtsText, '', findingsText].join('\n')

  function handleCopyAll() {
    navigator.clipboard.writeText(fullDoc).then(() => {
      setAllCopied(true)
      setTimeout(() => setAllCopied(false), 2500)
    })
  }

  // Summary counts for display
  const trAnswered = [...trResponses.values()].filter(r => effectiveTrStatus(r) !== 'unanswered').length
  const trGo       = [...trResponses.values()].filter(r => effectiveTrStatus(r) === 'go').length
  const trNoGo     = [...trResponses.values()].filter(r => effectiveTrStatus(r) === 'no_go').length
  const jtsAnswered = [...jtsResponses.values()].filter(r => r.status !== 'unanswered').length
  const jtsYes      = [...jtsResponses.values()].filter(r => r.status === 'yes').length
  const jtsNo       = [...jtsResponses.values()].filter(r => r.status === 'no').length

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="text-xs text-neutral-500 hover:text-neutral-700">
            ← Back
          </button>
          <span className="text-sm font-semibold text-neutral-800">
            {assessment.unit_name} — MCTIMS Export
          </span>
        </div>
        <button
          onClick={handleCopyAll}
          className={[
            'text-sm font-semibold px-4 py-1.5 rounded border transition-colors',
            allCopied
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-scarlet bg-scarlet text-white hover:opacity-90',
          ].join(' ')}
        >
          {allCopied ? '✓ Copied entire document' : 'Copy entire document'}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Info header */}
        <div className="mb-6 p-4 rounded-lg border border-neutral-200 bg-neutral-50">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">How to use this page</p>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Copy each section below and paste directly into MCTIMS. Use <strong>"Copy entire document"</strong> above
            to copy everything at once, or copy individual sections as needed. All assessor notes typed during
            the assessment are compiled into the Findings section.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="border border-neutral-200 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">T&R Results</p>
            <div className="flex gap-4 text-sm">
              <span><span className="font-bold text-neutral-700">{trAnswered}</span> <span className="text-neutral-400">scored</span></span>
              <span><span className="font-bold text-green-700">{trGo}</span> <span className="text-neutral-400">GO</span></span>
              <span><span className="font-bold text-red-700">{trNoGo}</span> <span className="text-neutral-400">NO-GO</span></span>
            </div>
          </div>
          <div className="border border-neutral-200 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">JTS Results</p>
            <div className="flex gap-4 text-sm">
              <span><span className="font-bold text-neutral-700">{jtsAnswered}</span> <span className="text-neutral-400">answered</span></span>
              <span><span className="font-bold text-green-700">{jtsYes}</span> <span className="text-neutral-400">YES</span></span>
              <span><span className="font-bold text-red-700">{jtsNo}</span> <span className="text-neutral-400">NO</span></span>
            </div>
          </div>
        </div>

        {/* Copy blocks */}
        <CopyBlock label="Unit Information" text={headerText} />
        <CopyBlock label="T&R Assessment Results (NAVMC 3500.84B)" text={trText} />
        <CopyBlock label="JTS Role 2 Assessment Results" text={jtsText} />
        <CopyBlock label="Assessor Findings — Compiled Notes" text={findingsText} />

        <p className="text-[10px] text-neutral-400 text-center mt-4">
          Generated {date} · CUI // BASIC · Unofficial — not endorsed by USMC, Navy, DHA, or JTS
        </p>
      </div>
    </div>
  )
}
