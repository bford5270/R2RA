import type { GroupItem as GroupItemType } from '@/types/content'
import { AcronymText } from './AcronymText'
import { ItemRenderer } from './ItemRenderer'

interface Props {
  item: GroupItemType
}

export function GroupItem({ item }: Props) {
  return (
    <div className="py-3 border-b border-neutral-100 last:border-0">
      <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
        <AcronymText text={item.label} />
      </p>
      <div className="pl-4 border-l-2 border-neutral-200 space-y-0">
        {item.sub_items.map((sub) => (
          <ItemRenderer key={sub.id} item={sub} nested />
        ))}
      </div>
    </div>
  )
}
