import type { TableCountsItem as TableCountsItemType } from '@/types/content'

interface Props {
  item: TableCountsItemType
}

export function TableCountsItem({ item }: Props) {
  return (
    <div className="py-3 border-b border-neutral-100 last:border-0">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
        {item.label}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-neutral-100">
              <th className="text-left px-2 py-1.5 font-semibold text-neutral-700 border border-neutral-200 text-xs">
                Personnel
              </th>
              {item.columns.map((col) => (
                <th
                  key={col.id}
                  className="text-center px-2 py-1.5 font-semibold text-neutral-700 border border-neutral-200 text-xs w-16"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {item.rows.map((row) => (
              <tr
                key={row.id}
                className={row.id === 'total' ? 'bg-neutral-50 font-semibold' : 'bg-white'}
              >
                <td className="px-2 py-1 text-neutral-800 border border-neutral-200 text-xs">
                  {row.label}
                </td>
                {item.columns.map((col) => (
                  <td key={col.id} className="px-2 py-1 border border-neutral-200 text-center">
                    <div className="h-5 w-10 mx-auto rounded bg-neutral-100 border border-neutral-200" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
