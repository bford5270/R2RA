import type { AssessmentItem, SelectOneItem } from '@/types/content'
import { AcronymText } from './AcronymText'
import { BinaryItem } from './BinaryItem'
import { TextLongItem } from './TextLongItem'
import { TableCountsItem } from './TableCountsItem'
import { TableYnItem } from './TableYnItem'
import { GroupItem } from './GroupItem'

interface Props {
  item: AssessmentItem
  nested?: boolean
}

function SelectOneRenderer({ item }: { item: SelectOneItem }) {
  return (
    <div className="py-2 border-b border-neutral-100 last:border-0">
      <p className="text-sm text-neutral-800 leading-snug mb-1">
        <AcronymText text={item.prompt} />
      </p>
      <div className="flex flex-wrap gap-2">
        {item.options.map((opt) => (
          <span
            key={opt.value}
            className="inline-flex items-center rounded border border-neutral-300 bg-neutral-50 text-neutral-500 text-xs px-2 py-0.5"
          >
            {opt.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ItemRenderer({ item, nested = false }: Props) {
  const cls = nested ? 'border-b-0 py-1.5 last:pb-0' : ''

  switch (item.type) {
    case 'binary':      return <div className={cls}><BinaryItem item={item} /></div>
    case 'text_long':   return <div className={cls}><TextLongItem item={item} /></div>
    case 'table_counts': return <div className={cls}><TableCountsItem item={item} /></div>
    case 'table_yn':    return <div className={cls}><TableYnItem item={item} /></div>
    case 'group':       return <div className={cls}><GroupItem item={item} /></div>
    case 'select_one':  return <div className={cls}><SelectOneRenderer item={item} /></div>
    default:            return null
  }
}
