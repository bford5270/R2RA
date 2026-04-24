import type { BinaryItem as BinaryItemType } from '@/types/content'
import { AcronymText } from './AcronymText'

interface Props {
  item: BinaryItemType
}

export function BinaryItem({ item }: Props) {
  return (
    <div className="py-3 border-b border-neutral-100 last:border-0">
      <div className="flex gap-4 items-start">
        <div className="flex gap-1 shrink-0 pt-0.5">
          {(['YES', 'NO', 'N/A'] as const).map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center justify-center rounded border border-neutral-300 bg-neutral-50 text-neutral-400 text-[10px] font-bold px-1.5 py-0.5 select-none"
            >
              {opt}
            </span>
          ))}
        </div>
        <p className="text-sm text-neutral-800 leading-snug">
          <AcronymText text={item.prompt} />
        </p>
      </div>

      {item.capture && (
        <div className="mt-2 ml-20 space-y-1">
          {item.capture.map((field) => (
            <div key={field.id} className="flex flex-col gap-0.5">
              <label className="text-xs text-neutral-500">
                <AcronymText text={field.label} />
              </label>
              <div className="h-7 rounded border border-neutral-200 bg-neutral-50 w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
