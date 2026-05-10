/**
 * Persistent CUI banner — must appear at top AND bottom of every screen.
 * Per NARA CUI Program requirements for CUI Basic handling.
 */
export function CuiBanner() {
  return (
    <div
      role="banner"
      aria-label="Classification banner"
      className="fixed left-0 right-0 z-50 flex items-center justify-center bg-cui-bg text-cui-text text-xs font-bold tracking-widest uppercase select-none"
      style={{ height: 'var(--cui-banner-height)' }}
    >
      Controlled Unclassified Information // Basic
    </div>
  )
}

export function CuiBannerTop() {
  return <div className="top-0"><CuiBannerFixed position="top" /></div>
}

export function CuiBannerBottom() {
  return <div className="bottom-0"><CuiBannerFixed position="bottom" /></div>
}

function CuiBannerFixed({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div
      role={position === 'top' ? 'banner' : 'contentinfo'}
      aria-label={`Classification banner — ${position}`}
      className={`fixed left-0 right-0 z-50 flex items-center justify-center bg-cui-bg text-cui-text text-xs font-bold tracking-widest uppercase select-none ${position === 'top' ? 'top-0' : 'bottom-0'}`}
      style={{ height: 'var(--cui-banner-height)' }}
    >
      Controlled Unclassified Information // Basic
    </div>
  )
}
