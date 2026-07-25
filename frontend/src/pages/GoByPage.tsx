import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

/**
 * Evaluator Go-By — an interactive quick-reference for T&R evaluators.
 *
 * Walks the full field workflow: install the app on your phone, request an
 * account, find the tasking S3T assigned you, score your PECLs/METs (with a
 * live practice wicket), and return the tasking to S3T.
 *
 * Public route — instructions only, no assessment data. Also printable as a
 * one-page paper go-by.
 */

const DONE_KEY = 'r2ra-goby-done' // localStorage: JSON array of step ids (UI preference, no CUI)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// ---------------------------------------------------------------------------
// Practice wicket — a sandboxed score card with fake data
// ---------------------------------------------------------------------------

const DEMO_COMPONENTS = [
  'Assemble equipment and verify function',
  'Perform procedure per published standard',
  'Document intervention and disposition',
]

const SCORE_LABELS: Record<number, string> = {
  1: 'Non-performant',
  2: 'Significant deficiencies',
  3: 'Approaches standard',
  4: 'Meets standard',
  5: 'Exceeds standard',
}

function DemoWicket() {
  const [scores, setScores] = useState<(number | null)[]>([null, null, null])
  const [note, setNote] = useState('')

  const scored = scores.filter((s): s is number => s !== null)
  const effective = scored.length === DEMO_COMPONENTS.length ? Math.min(...scored) : null

  function scoreStyle(active: boolean, n: number): React.CSSProperties {
    if (!active) return { borderColor: 'var(--border-1)', color: 'var(--ink-2)' }
    if (n <= 1) return { borderColor: 'var(--signal-red)', background: 'rgba(179,58,58,0.18)', color: 'var(--signal-red)' }
    if (n <= 3) return { borderColor: 'var(--signal-amber)', background: 'rgba(201,154,46,0.20)', color: 'var(--signal-amber)' }
    return { borderColor: 'var(--signal-green)', background: 'rgba(107,127,79,0.22)', color: 'var(--signal-green)' }
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-neutral-400 bg-neutral-100 p-4 print:hidden">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[10px] font-mono font-bold text-neutral-700">HSS-DEMO-0001</p>
        <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ background: 'rgba(91,122,139,0.22)', color: 'var(--signal-blue)' }}>
          Practice — not saved
        </span>
      </div>
      <p className="text-sm font-semibold text-neutral-800 mb-3">Conduct casualty treatment drill (example)</p>

      {DEMO_COMPONENTS.map((comp, i) => (
        <div key={i} className="mb-3">
          <p className="text-xs text-neutral-600 mb-1.5">{i + 1}. {comp}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setScores(prev => prev.map((s, j) => (j === i ? (s === n ? null : n) : s)))}
                className="w-10 h-10 min-h-[40px] rounded border-2 text-sm font-bold transition-colors"
                style={scoreStyle(scores[i] === n, n)}
                aria-label={`Score ${n}: ${SCORE_LABELS[n]}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        placeholder="Observation notes — what you saw, by exception…"
        className="w-full rounded border border-neutral-300 px-3 py-2 text-xs bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
      />

      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-neutral-500">Wicket score (lowest component):</span>
        {effective !== null ? (
          <span className="font-bold" style={scoreStyle(true, effective)}>
            &nbsp;{effective} — {SCORE_LABELS[effective]}&nbsp;
          </span>
        ) : (
          <span className="text-neutral-400 italic">score all {DEMO_COMPONENTS.length} components</span>
        )}
      </div>
      <p className="text-[10px] text-neutral-400 mt-1.5">
        1 = non-performant · 4 = meets standard · 5 = exceeds. Scores of 1–2 should always carry a note.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Go-by page
// ---------------------------------------------------------------------------

export function GoByPage() {
  const { isAuthenticated } = useAuth()
  const [done, setDone] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const [openStep, setOpenStep] = useState<string | null>('install')
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function toggleDone(id: string) {
    setDone(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const steps = useMemo(
    () => [
      { id: 'install', n: 1, title: 'Install the app on your phone' },
      { id: 'account', n: 2, title: 'Create your login' },
      { id: 'tasking', n: 3, title: 'Find your tasking from S3T' },
      { id: 'score', n: 4, title: 'Score your PECLs and METs' },
      { id: 'return', n: 5, title: 'Return your tasking to S3T' },
    ],
    []
  )

  const StepShell = ({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) => {
    const isOpen = openStep === id
    const isDone = done.has(id)
    return (
      <div
        className="rounded-lg border overflow-hidden print:border-0 print:rounded-none"
        style={{ borderColor: isDone ? 'var(--signal-green)' : 'var(--border-1)', background: 'var(--surface-1)' }}
      >
        <button
          onClick={() => setOpenStep(isOpen ? null : id)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left print:hidden"
        >
          <span
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0"
            style={
              isDone
                ? { borderColor: 'var(--signal-green)', color: 'var(--signal-green)', background: 'rgba(107,127,79,0.15)' }
                : { borderColor: 'var(--ink-3)', color: 'var(--ink-2)' }
            }
          >
            {isDone ? '✓' : n}
          </span>
          <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--ink-1)' }}>{title}</span>
          <span className="text-neutral-400 text-xs">{isOpen ? '▾' : '▸'}</span>
        </button>
        {/* Print always shows content; screen only when open */}
        <div className={`${isOpen ? 'block' : 'hidden'} print:block px-4 pb-4 lg:px-14`}>
          <p className="hidden print:block text-sm font-bold mb-1">{n}. {title}</p>
          {children}
          <button
            onClick={() => toggleDone(id)}
            className="mt-3 text-[11px] font-semibold underline print:hidden"
            style={{ color: isDone ? 'var(--signal-green)' : 'var(--ink-3)' }}
          >
            {isDone ? '✓ Marked done — undo' : 'Mark this step done'}
          </button>
        </div>
      </div>
    )
  }

  const p = 'text-xs leading-relaxed'
  const pStyle = { color: 'var(--ink-2)' } as React.CSSProperties

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-9 w-9" style={{ color: 'var(--ink-1)' }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>Evaluator Go-By</p>
                <h1 className="font-display text-xl font-bold leading-tight" style={{ color: 'var(--ink-1)' }}>
                  T&R Evaluation on Your Phone
                </h1>
              </div>
            </div>
            <p className="text-xs" style={pStyle}>
              Five steps: install → log in → find your tasking → score it → return it.
              S3T assigns you specific PECLs and METs; you complete only those and return them.
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end print:hidden shrink-0">
            <button
              onClick={() => window.print()}
              className="text-[10px] border border-neutral-400 rounded px-2.5 py-1.5 text-neutral-500 hover:text-neutral-700"
            >
              Print go-by
            </button>
            <Link to={isAuthenticated ? '/' : '/login'} className="text-[10px] text-scarlet font-semibold hover:underline">
              {isAuthenticated ? '← Home' : 'Sign in →'}
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {/* Step 1 — Install */}
          <StepShell {...steps[0]}>
            {installed ? (
              <p className={p} style={{ color: 'var(--signal-green)' }}>
                ✓ You're already running the installed app. Move to step 2.
              </p>
            ) : isIos() ? (
              <div className="space-y-2">
                <p className={p} style={pStyle}>On iPhone/iPad, open this page in <strong>Safari</strong>, then:</p>
                <ol className={`${p} list-none space-y-2`} style={pStyle}>
                  <li className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded border border-neutral-400 flex items-center justify-center shrink-0" aria-hidden="true">
                      {/* iOS share icon */}
                      <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 1v8M3.5 3.5 6 1l2.5 2.5"/><path d="M2 6H1v7h10V6h-1"/></svg>
                    </span>
                    Tap the <strong>Share</strong> button (bottom of Safari)
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded border border-neutral-400 flex items-center justify-center text-sm shrink-0" aria-hidden="true">＋</span>
                    Scroll down, tap <strong>Add to Home Screen</strong>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded border border-neutral-400 flex items-center justify-center shrink-0">
                      <img src="/icons/app/icon-192.png" alt="" className="w-4 h-4 rounded-sm" />
                    </span>
                    Tap <strong>Add</strong> — the R2RA icon appears on your home screen
                  </li>
                </ol>
                <p className={p} style={pStyle}>
                  Launch from that icon from now on: full-screen, and it keeps working on a weak connection.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className={p} style={pStyle}>
                  On Android (Chrome or Edge), tap Install below — or use the browser menu → <strong>Install app</strong>.
                </p>
                {installEvent && (
                  <button
                    onClick={async () => {
                      await installEvent.prompt()
                      const c = await installEvent.userChoice
                      if (c.outcome === 'accepted') { setInstalled(true); toggleDone('install') }
                      setInstallEvent(null)
                    }}
                    className="rounded px-4 py-2.5 text-xs font-bold min-h-[44px]"
                    style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
                  >
                    Install R2RA now
                  </button>
                )}
                <p className={p} style={pStyle}>
                  Launch from the home-screen icon from now on: full-screen, and it keeps working on a weak connection.
                </p>
              </div>
            )}
          </StepShell>

          {/* Step 2 — Account */}
          <StepShell {...steps[1]}>
            <div className="space-y-2">
              <p className={p} style={pStyle}>
                Open the app and tap <strong>Request access</strong> on the sign-in screen. Use your rank + name
                (e.g. “HM2 Smith”) so S3T recognizes you. You can sign in immediately and browse the assessment
                framework, but an administrator must <strong>approve</strong> your account before you can score.
              </p>
              <p className={p} style={pStyle}>
                Tell your S3T rep you've requested access — approval takes them about ten seconds.
              </p>
              <Link
                to="/register"
                className="inline-block rounded px-4 py-2 text-xs font-bold print:hidden"
                style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
              >
                Request access →
              </Link>
            </div>
          </StepShell>

          {/* Step 3 — Find tasking */}
          <StepShell {...steps[2]}>
            <div className="space-y-2">
              <p className={p} style={pStyle}>
                Once S3T assigns your PECLs/METs, a <strong>“Your Tasking”</strong> card appears at the top of
                your home screen the moment you sign in — unit, exercise, and a progress bar. Tap it and the app
                opens straight to <strong>only your assigned wickets</strong>, grouped by chapter. Nothing else
                to hunt through.
              </p>
              {/* Mini mock of the tasking card */}
              <div className="rounded-lg border p-3 max-w-sm print:hidden" style={{ background: 'rgba(91,122,139,0.10)', borderColor: 'rgba(91,122,139,0.40)' }} aria-hidden="true">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--ink-1)' }}>1st Med Bn — Example Co</p>
                    <p className="text-[10px]" style={pStyle}>1 of 4 wickets scored · MCT 4.5.1</p>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--signal-blue)' }}>Continue →</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.08)' }}>
                  <div className="h-full w-1/4 rounded-full" style={{ background: 'var(--signal-blue)' }} />
                </div>
              </div>
              <p className={p} style={pStyle}>
                If S3T left you instructions, they appear in the blue banner at the top of your tasking view.
              </p>
              {isAuthenticated && (
                <Link to="/" className="inline-block text-xs font-semibold text-scarlet hover:underline print:hidden">
                  Take me to my home screen →
                </Link>
              )}
            </div>
          </StepShell>

          {/* Step 4 — Score (interactive practice) */}
          <StepShell {...steps[3]}>
            <div className="space-y-2.5">
              <p className={p} style={pStyle}>
                Each wicket is a card. Score every <strong>component</strong> 1–5 against the published standard —
                the wicket score is the <strong>lowest</strong> component score. Scores of 1–2 need a note.
                Try it right here — this card is practice only, nothing is saved:
              </p>
              <DemoWicket />
              <p className={p} style={pStyle}>
                On the real card you'll also record the <strong>date conducted</strong>, whether the
                <strong> condition was met</strong>, and <strong>headcount</strong>. Attach photos or documents
                with the paperclip if evidence is required. Everything auto-saves as you tap.
              </p>
            </div>
          </StepShell>

          {/* Step 5 — Return */}
          <StepShell {...steps[4]}>
            <div className="space-y-2">
              <p className={p} style={pStyle}>
                When every assigned wicket is scored, the <strong>“Return to S3T”</strong> button at the top of
                your tasking view lights up. Tap it and confirm. Your scores lock (S3T can reopen if a correction
                is needed) and your home-screen card flips to <strong>“✓ Returned to S3T.”</strong> That's your
                whole job done.
              </p>
              <p className={p} style={pStyle}>
                Working offline? Scores save when your connection returns — keep the app open until you see the
                saved indicators stop spinning before you walk away from coverage.
              </p>
            </div>
          </StepShell>
        </div>

        <p className="mt-8 text-center text-[10px] text-neutral-400 leading-relaxed">
          Unofficial — not endorsed by USMC, Navy, DHA, or JTS · Questions → your S3T representative
        </p>
      </div>
    </main>
  )
}
