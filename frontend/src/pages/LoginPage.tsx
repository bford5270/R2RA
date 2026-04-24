import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-block w-2 h-8 bg-scarlet mr-2 align-middle" aria-hidden />
          <span className="text-lg font-bold tracking-tight text-neutral-900 align-middle">
            R2RA
          </span>
          <p className="mt-1 text-xs text-neutral-500">
            Role 2 Readiness Assessment — sign in to continue
          </p>
        </div>

        {/* Card */}
        <div className="border border-neutral-200 rounded bg-white shadow-sm p-6">
          {screen === 'credentials' ? (
            <form onSubmit={handleCredentials} noValidate>
              <fieldset disabled={busy} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-neutral-600 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-scarlet/40 focus:border-scarlet disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-neutral-600 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-scarlet/40 focus:border-scarlet disabled:opacity-50"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-red-600 font-medium">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded bg-scarlet text-white text-sm font-semibold px-4 py-2.5 hover:bg-scarlet-dark transition-colors disabled:opacity-50"
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
              </fieldset>
            </form>
          ) : (
            <form onSubmit={handleTotp} noValidate>
              <div className="mb-4">
                <p className="text-sm font-semibold text-neutral-800">Two-factor authentication</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
              <fieldset disabled={busy} className="space-y-4">
                <div>
                  <label htmlFor="totp" className="block text-xs font-semibold text-neutral-600 mb-1">
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
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-scarlet/40 focus:border-scarlet disabled:opacity-50"
                    placeholder="000000"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-red-600 font-medium">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full rounded bg-scarlet text-white text-sm font-semibold px-4 py-2.5 hover:bg-scarlet-dark transition-colors disabled:opacity-50"
                >
                  {busy ? 'Verifying…' : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={() => { setScreen('credentials'); setError(null); setTotpCode('') }}
                  className="w-full text-xs text-neutral-500 hover:text-neutral-700 py-1"
                >
                  ← Back
                </button>
              </fieldset>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          Unofficial — not endorsed by USMC, Navy, DHA, or JTS
        </p>
      </div>
    </main>
  )
}
