import type { Section } from '@/types/content'
import { AcronymProvider } from './AcronymContext'
import { ItemRenderer } from './ItemRenderer'

interface Props {
  section: Section
}

function SectionItems({ section }: { section: Section }) {
  return (
    <div>
      <h2 className="text-base font-bold text-neutral-900 pb-3 mb-1 border-b border-neutral-200">
        {section.ordinal}. {section.title}
      </h2>

      {section.items?.map((item) => (
        <ItemRenderer key={item.id} item={item} />
      ))}

      {/* ARSRA appendix and similar sections have nested sub-sections */}
      {section.sections?.map((sub) => (
        <div key={sub.id} className="mt-6">
          <h3 className="text-sm font-bold text-neutral-800 pb-2 mb-1 border-b border-neutral-200">
            {sub.ordinal}. {sub.title}
          </h3>
          {sub.items?.map((item) => (
            <ItemRenderer key={item.id} item={item} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SectionView({ section }: Props) {
  return (
    // Key on section.id so AcronymProvider remounts (fresh seen-set) per section
    <AcronymProvider key={section.id}>
      <SectionItems section={section} />
    </AcronymProvider>
  )
}
