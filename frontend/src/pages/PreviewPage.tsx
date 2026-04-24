import { useState } from 'react'
import { useManifest, useSection } from '@/hooks/useContent'
import { SectionNav } from '@/components/preview/SectionNav'
import { SectionView } from '@/components/preview/SectionView'

export function PreviewPage() {
  const { data: manifest, isLoading: manifestLoading, error: manifestError } = useManifest()
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const { data: section, isLoading: sectionLoading } = useSection(
    activeSectionId ?? manifest?.sections_manifest[0]?.id ?? null,
  )

  const effectiveSectionId = activeSectionId ?? manifest?.sections_manifest[0]?.id ?? null

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
      {/* Left pane — section tree */}
      <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white overflow-y-auto">
        <div className="px-3 pt-4 pb-2 border-b border-neutral-100">
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

      {/* Center pane — section items */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {sectionLoading && (
            <p className="text-sm text-neutral-400">Loading section…</p>
          )}
          {section && <SectionView section={section} />}
        </div>
      </main>

      {/* Right pane — T&R crosswalk (stub) */}
      <aside className="w-72 shrink-0 border-l border-neutral-200 bg-neutral-50 overflow-y-auto hidden lg:block">
        <div className="px-4 pt-4 pb-2 border-b border-neutral-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            T&amp;R Crosswalk
          </p>
        </div>
        <div className="px-4 py-6 text-xs text-neutral-400 text-center">
          Wicket crosswalk panel coming in Phase 1.5
        </div>
      </aside>
    </div>
  )
}
