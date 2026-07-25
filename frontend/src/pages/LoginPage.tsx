import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import { useAuth } from '../lib/auth'

type Screen = 'credentials' | 'totp'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [screen, setScreen] = useState<Screen>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [partialToken, setPartialToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const totpRef = useRef<HTMLInputElement>(null)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.login(email, password)
      if (res.totp_required) {
        setPartialToken(res.access_token)
        setScreen('totp')
        // focus the TOTP input on next paint
        setTimeout(() => totpRef.current?.focus(), 50)
      } else {
        setToken(res.access_token)
        const user = await api.me()
        login(res.access_token, user)
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.totpComplete(partialToken, totpCode)
      setToken(res.access_token)
      const user = await api.me()
      login(res.access_token, user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
      setTotpCode('')
      totpRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Brand lockup */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-12 w-12" />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, textAlign: 'left' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink-1)' }}>
                ROLE 2
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-3)', marginTop: 3 }}>
                READINESS ASSESSMENT
              </span>
            </div>
          </div>
          <p className="text-xs text-neutral-500">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-50 border border-neutral-400 rounded-lg shadow-2 px-8 py-8">
          {screen === 'credentials' ? (
            <form onSubmit={handleCredentials} noValidate>
              <fieldset disabled={busy} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2.5 text-sm bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2.5 text-sm bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 disabled:opacity-50"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-red-600 font-medium">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded bg-scarlet text-white text-sm font-bold px-4 py-3 hover:bg-scarlet-dark transition-colors disabled:opacity-50 mt-2"
                >
                  {busy ? 'Signing in…' : 'Sign in →'}
                </button>
              </fieldset>
            </form>
          ) : (
            <form onSubmit={handleTotp} noValidate>
              <div className="mb-6 text-center">
                <p className="font-display text-base font-semibold text-neutral-800">Two-factor</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Enter the 6-digit code from your authenticator.
                </p>
              </div>
              <fieldset disabled={busy} className="space-y-5">
                <div>
                  <label htmlFor="totp" className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide">
                    Authenticator code
                  </label>
                  <input
                    id="totp"
                    ref={totpRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded border border-neutral-300 px-3 py-3 text-lg font-mono tracking-[0.3em] text-center bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 disabled:opacity-50"
                    placeholder="— — — — — —"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-red-600 font-medium">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded bg-scarlet text-white text-sm font-bold px-4 py-3 hover:bg-scarlet-dark transition-colors disabled:opacity-50"
                >
                  {busy ? 'Verifying…' : 'Verify →'}
                </button>
                <button
                  type="button"
                  onClick={() => { setScreen('credentials'); setError(null); setTotpCode('') }}
                  className="w-full text-xs text-neutral-400 hover:text-neutral-600 py-1 transition-colors"
                >
                  ← Back to sign in
                </button>
              </fieldset>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Need an account?{' '}
          <Link to="/register" className="text-scarlet hover:underline font-semibold">Request access</Link>
        </p>
        <p className="mt-2 text-center text-xs text-neutral-500">
          New evaluator?{' '}
          <Link to="/go-by" className="text-scarlet hover:underline font-semibold">Read the go-by</Link>
        </p>

        <p className="mt-6 text-center text-[10px] text-neutral-400 leading-relaxed">
          Unofficial — not endorsed by USMC, Navy, DHA, or JTS
        </p>
      </div>
    </main>
  )
}
