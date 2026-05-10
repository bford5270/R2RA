import { useCallback, useEffect, useRef, useState } from 'react'
import { useManifest, useSection } from '@/hooks/useContent'
import { SectionNav } from '@/components/preview/SectionNav'
import { SectionView } from '@/components/preview/SectionView'
import { api } from '../lib/api'
import type { CrosswalkEntry } from '../types/crosswalk'

const NAV_WIDTH = 224  // px — left section-nav column
const MIN_SPLIT = 20  // % minimum for either pane
const DEFAULT_SPLIT = 50  // % for crosswalk pane

function CrosswalkContent({ sectionId }: { sectionId: string | null }) {
  const [entries, setEntries] = useState<CrosswalkEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sectionId) return
    setLoading(true)
    api.getCrosswalk(sectionId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [sectionId])

  const confidenceColor = (c: string) =>
    c === 'high' ? 'text-green-600' : c === 'medium' ? 'text-yellow-600' : 'text-neutral-400'

  return (
    <>
      <div className="px-4 pt-4 pb-2 border-b border-neutral-100 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">T&amp;R Crosswalk</p>
        <p className="text-[10px] text-neutral-400 mt-0.5">NAVMC 3500.84B</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {loading && <p className="text-xs text-neutral-400">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-neutral-400 italic">No crosswalk mappings for this section.</p>
        )}
        {entries.map(entry => (
          <div key={entry.jts_item} className="text-xs">
            <p className="font-mono text-neutral-500 text-[10px] mb-1">{entry.jts_item}</p>
            {entry.wickets.map(w => (
              <div key={w.event_code} className="mb-1.5 pl-2 border-l-2 border-neutral-200">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-scarlet text-[10px] font-semibold">{w.event_code}</span>
                  <span className={`text-[10px] font-semibold ${confidenceColor(w.confidence)}`}>
                    {w.confidence}
                  </span>
                </div>
                {w.rationale && (
                  <p className="text-neutral-500 text-[10px] mt-0.5 leading-snug">{w.rationale}</p>
                )}
              </div>
            ))}
            {entry.mets?.map(m => (
              <div key={m.id} className="mb-1 pl-2 border-l-2 border-blue-100">
                <span className="font-mono text-blue-600 text-[10px]">{m.id}</span>
                <span className={`ml-1.5 text-[10px] ${confidenceColor(m.confidence)}`}>{m.confidence}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function PreviewPage() {
  const { data: manifest, isLoading: manifestLoading, error: manifestError } = useManifest()
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const { data: section, isLoading: sectionLoading } = useSection(
    activeSectionId ?? manifest?.sections_manifest[0]?.id ?? null,
  )
  const effectiveSectionId = activeSectionId ?? manifest?.sections_manifest[0]?.id ?? null

  // crosswalkPct = % of the right-of-nav area given to the crosswalk pane
  const [crosswalkPct, setCrosswalkPct] = useState(DEFAULT_SPLIT)
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(ev: MouseEvent) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      // crosswalk is on the right; measure from right edge
      const pct = ((rect.right - ev.clientX) / rect.width) * 100
      setCrosswalkPct(Math.min(100 - MIN_SPLIT, Math.max(MIN_SPLIT, pct)))
    }

    function onMouseUp() {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  if (manifestLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">
        Loading framework…
      </div>
    )
  }

  if (manifestError || !manifest) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-red-600">
        Failed to load framework. Is the backend running?
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left nav — fixed width */}
      <aside
        className="shrink-0 border-r border-neutral-200 bg-white overflow-y-auto flex flex-col"
        style={{ width: NAV_WIDTH }}
      >
        <div className="px-3 pt-4 pb-2 border-b border-neutral-100 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            {manifest.title}
          </p>
          <p className="text-xs text-neutral-500">{manifest.subtitle}</p>
        </div>
        <SectionNav
          sections={manifest.sections_manifest}
          activeSectionId={effectiveSectionId}
          onSelect={setActiveSectionId}
        />
      </aside>

      {/* Resizable split area */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* JTS form pane */}
        <main
          className="overflow-y-auto bg-white"
          style={{ width: `${100 - crosswalkPct}%` }}
        >
          <div className="max-w-2xl mx-auto px-6 py-6">
            {sectionLoading && (
              <p className="text-sm text-neutral-400">Loading section…</p>
            )}
            {section && <SectionView section={section} />}
          </div>
        </main>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="w-1.5 shrink-0 bg-neutral-200 hover:bg-scarlet cursor-col-resize transition-colors"
          title="Drag to resize"
        />

        {/* T&R crosswalk pane */}
        <aside
          className="overflow-y-auto bg-neutral-50 border-l border-neutral-200 flex flex-col"
          style={{ width: `${crosswalkPct}%` }}
        >
          <CrosswalkContent sectionId={effectiveSectionId} />
        </aside>
      </div>
    </div>
  )
}
