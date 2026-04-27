import type { SectionManifestEntry } from '@/types/content'
import type { ItemResponse } from '@/types/assessment'
import type { AssignmentOut } from '@/types/user'

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

interface Props {
  sections: SectionManifestEntry[]
  activeSectionId: string | null
  onSelect: (id: string) => void
  responses?: Map<string, ItemResponse>
  assignments?: AssignmentOut[]
}

export function SectionNav({ sections, activeSectionId, onSelect, responses, assignments }: Props) {
  function hasSectionAnswered(s: SectionManifestEntry): boolean {
    if (!responses || !s.item_prefix) return false
    const prefix = s.item_prefix + '.'
    for (const [id, r] of responses.entries()) {
      if (id.startsWith(prefix) && r.status !== 'unanswered') return true
    }
    return false
  }

  function sectionAssignees(s: SectionManifestEntry): AssignmentOut[] {
    if (!assignments) return []
    return assignments.filter(a =>
      a.role === 'contributor' &&
      (a.scope_ids.length === 0 || a.scope_ids.includes(s.id))
    )
  }

  return (
    <nav aria-label="Form sections" className="flex flex-col gap-0.5 py-2">
      {sections.map((s) => {
        const isActive = activeSectionId === s.id
        const hasAnswered = hasSectionAnswered(s)
        const assignees = sectionAssignees(s)
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors',
              isActive
                ? 'bg-scarlet text-white font-semibold'
                : 'text-neutral-700 hover:bg-neutral-100',
            ].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className={[
                'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 border',
                isActive
                  ? 'border-white/40 text-white'
                  : 'border-neutral-300 text-neutral-400',
              ].join(' ')}
            >
              {s.ordinal}
            </span>
            <span className="flex-1 leading-snug">{s.title}</span>
            {!isActive && (
              <div className="flex items-center gap-1 shrink-0">
                {assignees.slice(0, 2).map(a => (
                  <span
                    key={a.id}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[8px] font-bold"
                    title={a.display_name}
                  >
                    {initials(a.display_name)}
                  </span>
                ))}
                {assignees.length > 2 && (
                  <span className="text-[8px] text-neutral-400">+{assignees.length - 2}</span>
                )}
                <span
                  className={`w-1.5 h-1.5 rounded-full ${hasAnswered ? 'bg-green-500' : 'bg-neutral-200'}`}
                  title={hasAnswered ? 'Has responses' : 'No responses yet'}
                />
              </div>
            )}
          </button>
        )
      })}
    </nav>
  )
}
