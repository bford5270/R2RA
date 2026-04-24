import type { TextLongItem as TextLongItemType } from '@/types/content'
import { AcronymText } from './AcronymText'

interface Props {
  item: TextLongItemType
}

export function TextLongItem({ item }: Props) {
  return (
    <div className="py-3 border-b border-neutral-100 last:border-0">
      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        <AcronymText text={item.label} />
      </label>
      <div className="mt-1.5 h-20 rounded border border-neutral-200 bg-neutral-50 w-full" />
    </div>
  )
}
