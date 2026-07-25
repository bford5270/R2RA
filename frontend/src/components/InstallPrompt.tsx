import { useEffect, useState } from 'react'

/**
 * Dismissible "install as app" prompt.
 *
 * - Chromium (Android/desktop): captures the `beforeinstallprompt` event and
 *   offers a one-tap Install button.
 * - iOS Safari: no install event exists, so show Share → Add to Home Screen
 *   instructions instead.
 * - Hidden entirely when already running as an installed app (standalone),
 *   or after the user dismisses it (flag in localStorage — UI preference
 *   only, no CUI content).
 */

const DISMISS_KEY = 'r2ra-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari legacy flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1' || isStandalone(),
  )

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (dismissed) return null

  const showIosHint = isIos() && !installEvent
  if (!installEvent && !showIosHint) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setDismissed(true)
    setInstallEvent(null)
  }

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-lg border p-4"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border-1)' }}
    >
      <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 mt-0.5" style={{ color: 'var(--ink-1)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--ink-1)' }}>
          Use R2RA as a mobile app
        </p>
        {showIosHint ? (
          <p className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
            Tap <span className="font-semibold">Share</span> then{' '}
            <span className="font-semibold">Add to Home Screen</span> to install.
            It opens full-screen and keeps working with a weak connection.
          </p>
        ) : (
          <p className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
            Install to your home screen — full-screen, and keeps working with a
            weak connection.
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          {installEvent && (
            <button
              onClick={install}
              className="rounded px-3 py-1.5 text-xs font-bold"
              style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
            >
              Install app
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-xs underline"
            style={{ color: 'var(--ink-3)' }}
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="text-sm leading-none px-1"
        style={{ color: 'var(--ink-3)' }}
      >
        ✕
      </button>
    </div>
  )
}
