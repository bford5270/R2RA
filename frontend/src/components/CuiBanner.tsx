/**
 * Persistent CUI banner — must appear at top AND bottom of every screen.
 * Per NARA CUI Program requirements for CUI Basic handling.
 *
 * Visual spec: design system --classification-bg / --classification-fg (Manual theme).
 * Dark coyote background (#3A3025) with warm cream text (#F1E8D4).
 */
import type { CSSProperties } from 'react'

const BANNER_TEXT = 'Controlled Unclassified Information // Basic'

const bannerStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 'var(--cui-banner-height)',
  background: 'var(--classification-bg)',
  color: 'var(--classification-fg)',
  fontFamily: 'var(--font-body)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  userSelect: 'none',
}

function CuiBannerFixed({ position }: { position: 'top' | 'bottom' }) {
  // Installed-app mode (viewport-fit=cover): extend the banner background
  // under the device status bar / home indicator via safe-area insets so
  // the CUI marking is never clipped by a notch.
  const safeArea: CSSProperties =
    position === 'top'
      ? {
          top: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(var(--cui-banner-height) + env(safe-area-inset-top, 0px))',
        }
      : {
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(var(--cui-banner-height) + env(safe-area-inset-bottom, 0px))',
        }
  return (
    <div
      role={position === 'top' ? 'banner' : 'contentinfo'}
      aria-label={`Classification banner — ${position}`}
      style={{ ...bannerStyle, ...safeArea }}
    >
      {BANNER_TEXT}
    </div>
  )
}

export function CuiBanner() {
  return (
    <div
      role="banner"
      aria-label="Classification banner"
      style={{ ...bannerStyle, position: 'relative' }}
    >
      {BANNER_TEXT}
    </div>
  )
}

export function CuiBannerTop() {
  return <CuiBannerFixed position="top" />
}

export function CuiBannerBottom() {
  return <CuiBannerFixed position="bottom" />
}
