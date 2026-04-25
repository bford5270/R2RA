import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment, ItemResponse } from '../types/assessment'
import { MISSION_TYPE_LABELS } from '../types/assessment'
import type { Manifest, Section, AssessmentItem, SectionManifestEntry } from '@/types/content'

function isSectionVisible(entry: SectionManifestEntry, missionType: string): boolean {
  if (!entry.visible_when) return true
  const mt = entry.visible_when.mission_type
  return !mt || mt === missionType
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusSymbol(s: string | undefined) {
  switch (s) {
    case 'yes': return '✓'
    case 'no':  return '✗'
    case 'na':  return 'N/A'
    default:    return '○'
  }
}

function statusClass(s: string | undefined) {
  switch (s) {
    case 'yes': return 'text-green-700 font-bold'
    case 'no':  return 'text-red-700 font-bold'
    case 'na':  return 'text-neutral-500'
    default:    return 'text-neutral-300'
  }
}

// ---------------------------------------------------------------------------
// Item renderers (print-only, no interactive controls)
// ---------------------------------------------------------------------------

function PrintItem({
  item,
  responses,
  nested = false,
}: {
  item: AssessmentItem
  responses: Map<string, ItemResponse>
  nested?: boolean
}) {
  const resp = responses.get(item.id)
  const indent = nested ? 'pl-4' : ''

  if (item.type === 'group') {
    return (
      <div className={`${indent} mb-2`}>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">
          {item.label}
        </p>
        {item.sub_items.map(sub => (
          <PrintItem key={sub.id} item={sub} responses={responses} nested />
        ))}
      </div>
    )
  }

  const prompt =
    item.type === 'binary' ? item.prompt :
    item.type === 'text_long' ? item.label :
    item.type === 'select_one' ? item.prompt :
    'label' in item ? item.label : item.id

  return (
    <div className={`${indent} py-1 border-b border-neutral-100 last:border-0`}>
      <div className="flex gap-2 items-start">
        <span className={`text-xs shrink-0 w-6 text-center mt-0.5 ${statusClass(resp?.status)}`}>
          {statusSymbol(resp?.status)}
        </span>
        <div className="flex-1">
          <p className="text-[11px] text-neutral-800 leading-snug">{prompt}</p>
          {resp?.note && (
            <p className="text-[10px] text-neutral-500 italic mt-0.5 pl-1 border-l border-neutral-200">
              {resp.note}
            </p>
          )}
        </div>
        <span className="text-[9px] font-mono text-neutral-300 shrink-0">{item.id}</span>
      </div>
    </div>
  )
}

function PrintSection({
  section,
  responses,
}: {
  section: Section
  responses: Map<string, ItemResponse>
}) {
  const allItems: AssessmentItem[] = [
    ...section.items,
    ...(section.sections?.flatMap(s => s.items) ?? []),
  ]
  const answered = allItems.filter(i => {
    const r = responses.get(i.id)
    return r && r.status !== 'unanswered'
  }).length
  const total = allItems.length

  return (
    <div className="mb-6 break-inside-avoid-page">
      <div className="flex items-baseline justify-between mb-1 border-b-2 border-neutral-200 pb-1">
        <h2 className="text-sm font-bold text-neutral-900">{section.title}</h2>
        <span className="text-[10px] text-neutral-400">{answered}/{total}</span>
      </div>

      {section.sections?.map(sub => (
        <div key={sub.id} className="mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">
            {sub.title}
          </h3>
          {sub.items.map(item => (
            <PrintItem key={item.id} item={item} responses={responses} />
          ))}
        </div>
      ))}

      {section.items.map(item => (
        <PrintItem key={item.id} item={item} responses={responses} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PrintPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [responses, setResponses] = useState<Map<string, ItemResponse>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [loadingMsg, setLoadingMsg] = useState('Loading assessment…')

  useEffect(() => {
    if (!assessmentId) return

    async function load() {
      try {
        setLoadingMsg('Loading assessment…')
        const [a, rs, mRaw] = await Promise.all([
          api.getAssessment(assessmentId!),
          api.listResponses(assessmentId!),
          api.manifest(),
        ])
        setAssessment(a)
        setResponses(new Map(rs.map(r => [r.item_id, r])))
        const m = mRaw as Manifest
        setManifest(m)

        const visibleEntries = m.sections_manifest.filter(s =>
          isSectionVisible(s, a.mission_type)
        )
        setLoadingMsg(`Loading ${visibleEntries.length} sections…`)
        const loaded = await Promise.all(
          visibleEntries.map(s => api.section(s.id) as Promise<Section>)
        )
        setSections(loaded)
        setLoadingMsg('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      }
    }

    load()
  }, [assessmentId])

  if (error) {
    return <div className="p-8 text-red-600 text-sm">{error}</div>
  }

  if (loadingMsg || !assessment || !manifest || sections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">
        {loadingMsg || 'Loading…'}
      </div>
    )
  }

  const allResponses = [...responses.values()]
  const answeredCount = allResponses.filter(r => r.status !== 'unanswered').length
  const yesCount  = allResponses.filter(r => r.status === 'yes').length
  const noCount   = allResponses.filter(r => r.status === 'no').length
  const naCount   = allResponses.filter(r => r.status === 'na').length
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-white">
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-neutral-800">
            {assessment.unit_name} — Print Preview
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded bg-scarlet text-white text-xs font-semibold px-4 py-1.5 hover:bg-scarlet-dark transition-colors"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Report body */}
      <div className="max-w-4xl mx-auto px-8 py-8 print:px-6 print:py-4">

        {/* Cover block */}
        <div className="mb-8 pb-6 border-b-2 border-neutral-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
                CONTROLLED UNCLASSIFIED INFORMATION // BASIC
              </p>
              <h1 className="text-xl font-bold text-neutral-900">
                JTS Role 2 Readiness Assessment
              </h1>
              <p className="text-sm text-neutral-600 mt-0.5">{manifest.subtitle}</p>
            </div>
            <div className="text-right text-xs text-neutral-500 space-y-0.5">
              <p className="font-mono font-bold text-neutral-700">{assessment.unit_uic}</p>
              <p>{assessment.unit_name}</p>
              <p>{MISSION_TYPE_LABELS[assessment.mission_type]}</p>
              {assessment.service && <p>{assessment.service}{assessment.component ? ` / ${assessment.component}` : ''}</p>}
              <p className="mt-1 text-neutral-400">{date}</p>
              <p className={`font-semibold mt-1 ${assessment.status === 'certified' ? 'text-green-700' : 'text-neutral-500'}`}>
                {assessment.status.replace(/_/g, ' ').toUpperCase()}
              </p>
            </div>
          </div>

          {/* Summary row */}
          <div className="mt-4 grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Answered', val: answeredCount, cls: 'text-neutral-700' },
              { label: 'YES',  val: yesCount,  cls: 'text-green-700' },
              { label: 'NO',   val: noCount,   cls: 'text-red-700' },
              { label: 'N/A',  val: naCount,   cls: 'text-neutral-500' },
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

        {/* Sections */}
        {sections.map(section => (
          <PrintSection key={section.id} section={section} responses={responses} />
        ))}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-200 text-[9px] text-neutral-400 flex justify-between">
          <span>R2RA · {manifest.framework_id} v{manifest.version}</span>
          <span>CONTROLLED UNCLASSIFIED INFORMATION // BASIC</span>
          <span>Generated {date}</span>
        </div>
      </div>
    </div>
  )
}
