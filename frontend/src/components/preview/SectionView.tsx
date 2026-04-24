import type { Section } from '@/types/content'
import { BinaryItem } from './BinaryItem'
import { TextLongItem } from './TextLongItem'
import { TableCountsItem } from './TableCountsItem'

interface Props {
  section: Section
}

export function SectionView({ section }: Props) {
  return (
    <div>
      <h2 className="text-base font-bold text-neutral-900 pb-3 mb-1 border-b border-neutral-200">
        {section.ordinal}. {section.title}
      </h2>

      <div className="divide-y divide-neutral-100">
        {section.items.map((item) => {
          if (item.type === 'binary') {
            return <BinaryItem key={item.id} item={item} />
          }
          if (item.type === 'text_long') {
            return <TextLongItem key={item.id} item={item} />
          }
          if (item.type === 'table_counts') {
            return <TableCountsItem key={item.id} item={item} />
          }
          return null
        })}
      </div>
    </div>
  )
}
