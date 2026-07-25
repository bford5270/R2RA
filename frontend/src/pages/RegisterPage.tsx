import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import { useAuth } from '../lib/auth'

/**
 * Open account request page.
 *
 * Anyone can create a login. The account starts as "pending": the user can
 * sign in and browse the read-only JTS form preview, but an administrator
 * must approve the account (assign a role) before they can participate in
 * assessments. Everything in the app is unclassified reference content, so
 * browsing before approval is acceptable; assessment data stays gated.
 */
export function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      await api.requestAccount(displayName.trim(), email.trim(), password)
      // Sign the new user straight in — they land on the pending home view.
      const res = await api.login(email.trim(), password)
      setToken(res.access_token)
      const user = await api.me()
      login(res.access_token, user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded border border-neutral-300 px-3 py-2.5 text-sm bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 disabled:opacity-50'
  const labelClass =
    'block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wide'

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
          <p className="text-xs text-neutral-500">Request an account</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-50 border border-neutral-400 rounded-lg shadow-2 px-8 py-8">
          <form onSubmit={handleSubmit} noValidate>
            <fieldset disabled={busy} className="space-y-5">
              <div>
                <label htmlFor="displayName" className={labelClass}>Name</label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className={inputClass}
                  placeholder="Rank + name, e.g. HM2 Smith"
                />
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className={labelClass}>Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirm" className={labelClass}>Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && (
                <p role="alert" className="text-xs text-red-600 font-medium">{error}</p>
              )}

              <button
                type="submit"
                className="w-full rounded bg-scarlet text-white text-sm font-bold px-4 py-3 hover:bg-scarlet-dark transition-colors disabled:opacity-50 mt-2"
              >
                {busy ? 'Creating account…' : 'Create account →'}
              </button>

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                You'll be able to sign in and explore the assessment framework
                right away. An administrator must approve your account before
                you can participate in assessments.
              </p>
            </fieldset>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Already have an account?{' '}
          <Link to="/login" className="text-scarlet hover:underline font-semibold">Sign in</Link>
        </p>

        <p className="mt-6 text-center text-[10px] text-neutral-400 leading-relaxed">
          Unofficial — not endorsed by USMC, Navy, DHA, or JTS
        </p>
      </div>
    </main>
  )
}
