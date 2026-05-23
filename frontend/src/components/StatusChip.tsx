const CHIP: Record<string, { bg: string; fg: string; dot: string }> = {
  draft:            { bg: 'var(--surface-2)',         fg: 'var(--ink-2)',         dot: 'var(--ink-3)' },
  in_progress:      { bg: 'rgba(91,122,139,0.22)',    fg: 'var(--signal-blue)',   dot: 'var(--signal-blue)' },
  ready_for_review: { bg: 'rgba(201,154,46,0.20)',    fg: 'var(--signal-amber)',  dot: 'var(--signal-amber)' },
  certified:        { bg: 'rgba(107,127,79,0.22)',    fg: 'var(--signal-green)',  dot: 'var(--signal-green)' },
}

const LABEL: Record<string, string> = {
  draft:            'Draft',
  in_progress:      'In Progress',
  ready_for_review: 'Ready for Review',
  certified:        'Certified',
}

export function StatusChip({ status, className = '' }: { status: string; className?: string }) {
  const chip = CHIP[status] ?? CHIP.draft
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: chip.bg,
        color: chip.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: chip.dot, flexShrink: 0 }} />
      {LABEL[status] ?? status.replace(/_/g, ' ')}
    </span>
  )
}
