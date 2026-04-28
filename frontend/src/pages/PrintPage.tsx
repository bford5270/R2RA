import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Assessment, ItemResponse } from '../types/assessment'
import { MISSION_TYPE_LABELS } from '../types/assessment'
import type {
  Manifest, Section, AssessmentItem, SectionManifestEntry,
  BinaryItem, TableYnItem, TableCountsItem,
} from '@/types/content'

function isSectionVisible(entry: SectionManifestEntry, missionType: string): boolean {
  if (!entry.visible_when) return true
  const mt = entry.visible_when.mission_type
  return !mt || mt === missionType
}

// ---------------------------------------------------------------------------
// Column header row — rendered once per section
// ---------------------------------------------------------------------------

function ColHeaders() {
  return (
    <div className="flex gap-2 items-center border-b-2 border-neutral-300 pb-0.5 mb-1">
      <span className="text-[9px] font-mono text-neutral-400 shrink-0 w-14" />
      <span className="flex-1" />
      <div className="flex shrink-0 text-[8px] font-bold uppercase tracking-wide text-neutral-500">
        <span className="w-7 text-center">YES</span>
        <span className="w-7 text-center">NO</span>
        <span className="w-8 text-center">N/A</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status cells for binary items
// ---------------------------------------------------------------------------

function YNACells({ status }: { status: string | undefined }) {
  return (
    <div className="flex shrink-0">
      <span className="w-7 text-center text-[11px] font-bold text-green-700">
        {status === 'yes' ? '✓' : ''}
      </span>
      <span className="w-7 text-center text-[11px] font-bold text-red-700">
        {status === 'no' ? '✗' : ''}
      </span>
      <span className="w-8 text-center text-[10px] text-neutral-500">
        {status === 'na' ? 'N/A' : ''}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual item renderers
// ---------------------------------------------------------------------------

function PrintBinaryRow({
  item,
  resp,
  nested = false,
}: {
  item: BinaryItem
  resp: ItemResponse | undefined
  nested?: boolean
}) {
  const captureData = resp?.capture_data as Record<string, string> | null | undefined
  const hasCaptureValues = item.capture && captureData &&
    item.capture.some(f => captureData[f.id])

  return (
    <>
      <div className={`flex gap-2 items-start py-0.5 border-b border-neutral-100 ${nested ? 'pl-4' : ''}`}>
        <span className="text-[8px] font-mono text-neutral-300 shrink-0 w-14 pt-0.5 leading-tight">{item.id}</span>
        <p className="flex-1 text-[11px] text-neutral-800 leading-snug">{item.prompt}</p>
        <YNACells status={resp?.status} />
      </div>
      {hasCaptureValues && (
        <div className={`flex gap-2 pb-0.5 border-b border-neutral-100 ${nested ? 'pl-4' : ''}`}>
          <span className="w-14 shrink-0" />
          <div className="flex flex-wrap gap-x-4 text-[10px] text-neutral-600">
            {item.capture!.map(f => {
              const val = captureData![f.id]
              if (!val) return null
              return (
                <span key={f.id}>
                  <span className="text-neutral-400">{f.label}:</span> {val}
                </span>
              )
            })}
          </div>
        </div>
      )}
      {resp?.note && (
        <div className={`flex gap-2 pb-0.5 border-b border-neutral-100 ${nested ? 'pl-4' : ''}`}>
          <span className="w-14 shrink-0" />
          <p className="text-[10px] text-neutral-500 italic leading-snug">Note: {resp.note}</p>
        </div>
      )}
    </>
  )
}

function PrintTableYn({
  item,
  resp,
}: {
  item: TableYnItem
  resp: ItemResponse | undefined
}) {
  return (
    <div className="py-1 border-b border-neutral-100">
      <div className="flex gap-2 items-start">
        <span className="text-[8px] font-mono text-neutral-300 shrink-0 w-14 pt-0.5">{item.id}</span>
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-neutral-700 mb-1">{item.label}</p>
          <div className="ml-2 space-y-0">
            {item.rows.map(row => (
              <div key={row.id} className="flex items-center gap-1 py-px border-b border-neutral-50 last:border-0">
                <span className="text-[9px] text-neutral-400 w-5 shrink-0">{row.id}</span>
                <span className="flex-1 text-[10px] text-neutral-700">{row.label}</span>
                <div className="flex shrink-0">
                  <span className="w-7 text-center text-[10px]">□</span>
                  <span className="w-7 text-center text-[10px]">□</span>
                  <span className="w-8 text-center text-[10px]">□</span>
                </div>
              </div>
            ))}
          </div>
          {resp?.note && (
            <p className="text-[10px] text-neutral-500 italic mt-1 pl-1 border-l border-neutral-200">
              Note: {resp.note}
            </p>
          )}
        </div>
        <YNACells status={resp?.status} />
      </div>
    </div>
  )
}

function PrintTableCounts({
  item,
  resp,
}: {
  item: TableCountsItem
  resp: ItemResponse | undefined
}) {
  return (
    <div className="py-1 border-b border-neutral-100">
      <div className="flex gap-2 items-start">
        <span className="text-[8px] font-mono text-neutral-300 shrink-0 w-14 pt-0.5">{item.id}</span>
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-neutral-700 mb-1">{item.label}</p>
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr>
                <th className="text-left text-neutral-500 pb-0.5 pr-2 w-1/3">Item</th>
                {item.columns.map(c => (
                  <th key={c.id} className="text-center text-neutral-500 pb-0.5 w-8">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.rows.map(row => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="py-px pr-2 text-neutral-700">{row.label}</td>
                  {item.columns.map(c => (
                    <td key={c.id} className="py-px text-center text-neutral-300">—</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {resp?.note && (
            <p className="text-[10px] text-neutral-500 italic mt-1 pl-1 border-l border-neutral-200">
              Note: {resp.note}
            </p>
          )}
        </div>
        <YNACells status={resp?.status} />
      </div>
    </div>
  )
}

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

  if (item.type === 'group') {
    return (
      <div className={nested ? 'pl-4' : ''}>
        <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 mt-2 mb-0.5">
          {item.label}
        </p>
        {item.sub_items.map(sub => (
          <PrintItem key={sub.id} item={sub} responses={responses} nested />
        ))}
      </div>
    )
  }

  if (item.type === 'binary') {
    return <PrintBinaryRow item={item} resp={resp} nested={nested} />
  }

  if (item.type === 'table_yn') {
    return <PrintTableYn item={item} resp={resp} />
  }

  if (item.type === 'table_counts') {
    return <PrintTableCounts item={item} resp={resp} />
  }

  // text_long and select_one
  const label = (item as { label?: string; prompt?: string; id: string }).label ?? (item as { prompt?: string }).prompt ?? item.id
  return (
    <div className={`py-1.5 border-b border-neutral-100 ${nested ? 'pl-4' : ''}`}>
      <div className="flex gap-2 items-start">
        <span className="text-[8px] font-mono text-neutral-300 shrink-0 w-14 pt-0.5">{item.id}</span>
        <div className="flex-1">
          <p className="text-[11px] text-neutral-700 leading-snug italic">{label}</p>
          {resp?.note ? (
            <p className="text-[11px] text-neutral-800 mt-1 leading-snug">{resp.note}</p>
          ) : (
            <p className="text-[10px] text-neutral-300 mt-1">—</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function PrintSection({
  section,
  responses,
}: {
  section: Section
  responses: Map<string, ItemResponse>
}) {
  // Count binary/selectable items for the section summary
  function countable(items: AssessmentItem[]): AssessmentItem[] {
    return items.flatMap(i => i.type === 'group' ? countable(i.sub_items) : [i])
  }
  const allItems = countable([
    ...section.items,
    ...(section.sections?.flatMap(s => s.items) ?? []),
  ])
  const answered = allItems.filter(i => {
    const r = responses.get(i.id)
    return r && r.status !== 'unanswered'
  }).length
  const total = allItems.length

  // Does this section have any binary items? (drives column headers)
  const hasBinary = allItems.some(i => i.type === 'binary' || i.type === 'select_one')

  return (
    <div className="mb-6 break-inside-avoid-page">
      {/* Section header */}
      <div className="flex items-baseline justify-between mb-1 border-b-2 border-neutral-800 pb-1">
        <h2 className="text-[12px] font-bold text-neutral-900 uppercase tracking-wide">
          {typeof section.ordinal === 'number' ? `${section.ordinal}. ` : ''}{section.title}
        </h2>
        <span className="text-[9px] text-neutral-400 shrink-0 ml-4">{answered}/{total}</span>
      </div>

      {hasBinary && <ColHeaders />}

      {section.sections?.map(sub => (
        <div key={sub.id} className="mb-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500 mt-2 mb-0.5">
            {sub.title}
          </p>
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
// Signature block
// ---------------------------------------------------------------------------

function SignatureBlock({ assessment }: { assessment: Assessment }) {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  function SigLine({ label, wide = false }: { label: string; wide?: boolean }) {
    return (
      <div className={`${wide ? 'col-span-2' : ''}`}>
        <div className="border-b border-neutral-700 h-6 mb-0.5" />
        <p className="text-[9px] text-neutral-500 uppercase tracking-wide">{label}</p>
      </div>
    )
  }

  return (
    <div className="mt-8 pt-4 border-t-2 border-neutral-800">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-700 mb-3">
        Assessment Certification
      </p>
      <p className="text-[10px] text-neutral-600 mb-4 leading-snug">
        The undersigned certify that this assessment was conducted in accordance with JTS guidance
        and that all entries are accurate and complete to the best of our knowledge.
      </p>

      <div className="mb-5">
        <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500 mb-2">
          Theater Medical Director / Lead Assessor
        </p>
        <div className="grid grid-cols-4 gap-4">
          <SigLine label="Last Name, First, MI" wide />
          <SigLine label="Rank / Rate" />
          <SigLine label="Date" />
          <SigLine label="Signature" wide />
          <SigLine label="Branch / Component" />
          <SigLine label="Phone / DSN" />
        </div>
      </div>

      <div className="mb-5">
        <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500 mb-2">
          Unit Commanding Officer / OIC Acknowledgment
        </p>
        <div className="grid grid-cols-4 gap-4">
          <SigLine label="Last Name, First, MI" wide />
          <SigLine label="Rank / Rate" />
          <SigLine label="Date" />
          <SigLine label="Signature" wide />
          <SigLine label="Unit UIC" />
          <SigLine label="Command" />
        </div>
      </div>

      <div className="text-[9px] text-neutral-400 space-y-0.5 mt-4">
        <p>Unit: <strong className="text-neutral-600">{assessment.unit_name}</strong> &nbsp;|&nbsp; UIC: <strong className="text-neutral-600">{assessment.unit_uic}</strong></p>
        <p>Mission Type: <strong className="text-neutral-600">{MISSION_TYPE_LABELS[assessment.mission_type]}</strong> &nbsp;|&nbsp; Assessment Date: <strong className="text-neutral-600">{date}</strong></p>
        {assessment.unique_identifier && (
          <p>Assessment ID: <strong className="text-neutral-600">{assessment.unique_identifier}</strong></p>
        )}
      </div>
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
        const m = mRaw as unknown as Manifest
        setManifest(m)

        const visibleEntries = m.sections_manifest.filter(s =>
          isSectionVisible(s, a.mission_type)
        )
        setLoadingMsg(`Loading ${visibleEntries.length} sections…`)
        const loaded = await Promise.all(
          visibleEntries.map(s => api.section(s.id) as unknown as Promise<Section>)
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
          className="rounded bg-scarlet text-white text-xs font-semibold px-4 py-1.5 hover:opacity-90 transition-opacity"
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Report body */}
      <div className="max-w-4xl mx-auto px-8 py-8 print:px-6 print:py-4">

        {/* Cover block */}
        <div className="mb-8 pb-6 border-b-2 border-neutral-800">
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">
            CONTROLLED UNCLASSIFIED INFORMATION // BASIC
          </p>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 leading-tight">
                JTS Role 2 Readiness Assessment
              </h1>
              <p className="text-sm text-neutral-600 mt-0.5">{manifest.subtitle}</p>
              <p className="text-[10px] text-neutral-400 mt-1">{manifest.framework_id} v{manifest.version}</p>
            </div>
            <div className="text-right text-xs text-neutral-600 space-y-0.5">
              <p className="font-mono font-bold text-neutral-800 text-sm">{assessment.unit_uic}</p>
              <p className="font-semibold">{assessment.unit_name}</p>
              <p>{MISSION_TYPE_LABELS[assessment.mission_type]}</p>
              {assessment.service && (
                <p>{assessment.service}{assessment.component ? ` / ${assessment.component}` : ''}</p>
              )}
              <p className="text-neutral-400">{date}</p>
              <p className={`font-bold mt-1 ${assessment.status === 'certified' ? 'text-green-700' : 'text-neutral-500'}`}>
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
            Unofficial tool — not endorsed by USMC, Navy, DHA, or JTS.
            Verify all entries against official JTS Role 2 Readiness Assessment form before submission.
          </p>
        </div>

        {/* Sections */}
        {sections.map(section => (
          <PrintSection key={section.id} section={section} responses={responses} />
        ))}

        {/* Signature block */}
        <SignatureBlock assessment={assessment} />

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
