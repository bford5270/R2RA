import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

// ---- Password change ----------------------------------------------------

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setMsg({ ok: false, text: 'New passwords do not match.' }); return }
    if (next.length < 8) { setMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return }
    setSaving(true); setMsg(null)
    try {
      await api.changePassword(current, next)
      setMsg({ ok: true, text: 'Password changed.' })
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-neutral-800 mb-3">Change password</h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        {(['Current password', 'New password', 'Confirm new password'] as const).map((label, i) => {
          const vals = [current, next, confirm]
          const setters = [setCurrent, setNext, setConfirm]
          return (
            <div key={label}>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                {label}
              </label>
              <input
                required
                type="password"
                value={vals[i]}
                onChange={e => setters[i](e.target.value)}
                className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-scarlet/40"
              />
            </div>
          )
        })}
        {msg && (
          <p className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-scarlet text-white text-xs font-semibold px-5 py-1.5 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}

// ---- TOTP management ----------------------------------------------------

function TotpSection({ enrolled, onChanged }: { enrolled: boolean; onChanged: () => void }) {
  const [step, setStep] = useState<'idle' | 'enrolling' | 'confirming'>('idle')
  const [secret, setSecret] = useState('')
  const [uri, setUri] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function startEnroll() {
    setBusy(true); setMsg(null)
    try {
      const data = await api.totpEnroll()
      setSecret(data.secret)
      setUri(data.uri)
      setStep('confirming')
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      await api.totpConfirm(secret, code.replace(/\s/g, ''))
      setMsg({ ok: true, text: 'TOTP enrolled. Future logins will require your authenticator code.' })
      setStep('idle'); setCode(''); setSecret(''); setUri('')
      onChanged()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Invalid code.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleUnenroll() {
    const pw = window.prompt('Enter your current password to remove TOTP:')
    if (!pw) return
    setBusy(true); setMsg(null)
    try {
      await api.totpUnenroll(pw)
      setMsg({ ok: true, text: 'TOTP removed.' })
      onChanged()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-neutral-800 mb-1">Two-factor authentication (TOTP)</h2>
      <p className="text-xs text-neutral-500 mb-3">
        {enrolled
          ? 'TOTP is active. Each login requires a 6-digit code from your authenticator app.'
          : 'TOTP is not active. Enable it for stronger account security.'}
      </p>

      {enrolled && step === 'idle' && (
        <button
          onClick={handleUnenroll}
          disabled={busy}
          className="rounded border border-red-200 text-xs text-red-600 px-4 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Removing…' : 'Remove TOTP'}
        </button>
      )}

      {!enrolled && step === 'idle' && (
        <button
          onClick={startEnroll}
          disabled={busy}
          className="rounded bg-scarlet text-white text-xs font-semibold px-5 py-1.5 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Enable TOTP'}
        </button>
      )}

      {step === 'confirming' && (
        <div className="space-y-3 max-w-sm border border-neutral-200 rounded p-4 bg-neutral-50">
          <p className="text-xs text-neutral-700 font-semibold">
            Scan the URI in your authenticator app, then enter the 6-digit code to confirm.
          </p>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Manual secret</p>
            <code className="block text-xs font-mono bg-white border border-neutral-200 rounded px-3 py-2 select-all break-all">
              {secret}
            </code>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">otpauth URI</p>
            <code className="block text-[10px] font-mono bg-white border border-neutral-200 rounded px-3 py-2 select-all break-all text-neutral-600">
              {uri}
            </code>
          </div>
          <form onSubmit={handleConfirm} className="space-y-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Authenticator code
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={7}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="123 456"
                className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-scarlet/40"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-scarlet text-white text-xs font-semibold px-5 py-1.5 hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Verify and activate'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('idle'); setSecret(''); setUri(''); setCode('') }}
                className="rounded border border-neutral-200 text-xs text-neutral-500 px-4 py-1.5 hover:border-neutral-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {msg && (
        <p className={`text-xs mt-2 ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </section>
  )
}

// ---- Page ---------------------------------------------------------------

export function ProfilePage() {
  const { user, refreshUser } = useAuth()

  if (!user) return null

  return (
    <main className="min-h-screen max-w-xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link to="/" className="text-xs text-neutral-400 hover:text-neutral-600 mb-1 block">
          ← Home
        </Link>
        <h1 className="text-lg font-bold text-neutral-900">Account settings</h1>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-sm font-bold text-neutral-500">
            {user.display_name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')}
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-800">{user.display_name}</p>
            <p className="text-xs text-neutral-400">{user.email} · {user.global_role}</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <PasswordSection />
        <hr className="border-neutral-100" />
        <TotpSection
          enrolled={user.totp_enrolled}
          onChanged={() => refreshUser?.()}
        />
      </div>
    </main>
  )
}
