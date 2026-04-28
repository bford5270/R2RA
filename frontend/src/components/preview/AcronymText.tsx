import { ACRONYMS } from '@/lib/acronyms'
import { useSeenAcronyms } from './AcronymContext'

interface Props {
  text: string
  className?: string
}

/**
 * Renders text with acronyms annotated.
 * First use in the current section: shows full definition followed by the
 * acronym in parentheses — e.g. "Area of Responsibility (AOR)".
 * Subsequent uses: shows an <abbr> with a hover tooltip only.
 */
export function AcronymText({ text, className }: Props) {
  const seenRef = useSeenAcronyms()

  // Build a regex that matches any key in the glossary (longest first to avoid
  // partial matches like "GS" inside "GSTT").
  const keys = Object.keys(ACRONYMS).sort((a, b) => b.length - a.length)
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g')

  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const [full, acronym] = match
    const def = ACRONYMS[acronym]

    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }

    if (seenRef && seenRef.current && !seenRef.current.has(acronym)) {
      seenRef.current.add(acronym)
      // First use — spell it out, then put acronym in parens
      parts.push(
        <abbr key={match.index} title={def} className="no-underline cursor-help">
          <span className="font-medium">{def}</span>
          {' ('}
          <span className="font-bold">{acronym}</span>
          {')'}
        </abbr>,
      )
    } else {
      // Subsequent use — abbreviation with tooltip only
      parts.push(
        <abbr key={match.index} title={def ?? acronym} className="no-underline cursor-help font-bold">
          {full}
        </abbr>,
      )
    }

    last = match.index + full.length
  }

  if (last < text.length) {
    parts.push(text.slice(last))
  }

  return <span className={className}>{parts}</span>
}
