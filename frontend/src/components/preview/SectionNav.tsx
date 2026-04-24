import type { SectionManifestEntry } from '@/types/content'

interface Props {
  sections: SectionManifestEntry[]
  activeSectionId: string | null
  onSelect: (id: string) => void
}

export function SectionNav({ sections, activeSectionId, onSelect }: Props) {
  return (
    <nav aria-label="Form sections" className="flex flex-col gap-0.5 py-2">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={[
            'flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors',
            activeSectionId === s.id
              ? 'bg-scarlet text-white font-semibold'
              : 'text-neutral-700 hover:bg-neutral-100',
          ].join(' ')}
          aria-current={activeSectionId === s.id ? 'page' : undefined}
        >
          <span
            className={[
              'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 border',
              activeSectionId === s.id
                ? 'border-white/40 text-white'
                : 'border-neutral-300 text-neutral-400',
            ].join(' ')}
          >
            {s.ordinal}
          </span>
          <span className="leading-snug">{s.title}</span>
        </button>
      ))}
    </nav>
  )
}
