import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { UserOut } from '../types/user'

const ROLE_LABELS: Record<string, string> = {
  admin:    'Admin',
  assessor: 'Assessor',
  observer: 'Observer',
}

const ROLE_COLOR: Record<string, string> = {
  admin:    'bg-scarlet/10 text-scarlet',
  assessor: 'bg-blue-50 text-blue-700',
  observer: 'bg-neutral-100 text-neutral-500',
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()

  const [users, setUsers] = useState<UserOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>('assessor')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Inline edit state per user
  const [editingRole, setEditingRole] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (currentUser?.global_role !== 'admin') {
      navigate('/')
      return
    }
    api.listUsers(true)
      .then(setUsers)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [currentUser, navigate])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const created = await api.createUser(displayName.trim(), email.trim(), password, role)
      setUsers(prev => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)))
      setShowCreate(false)
      setDisplayName('')
      setEmail('')
      setPassword('')
      setRole('assessor')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(u: UserOut) {
    setSaving(prev => ({ ...prev, [u.id]: true }))
    try {
      const updated = await api.updateUser(u.id, { is_active: !u.is_active })
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))
    } catch {
      // ignore
    } finally {
      setSaving(prev => ({ ...prev, [u.id]: false }))
    }
  }

  async function handleRoleChange(u: UserOut, newRole: string) {
    setEditingRole(prev => ({ ...prev, [u.id]: newRole }))
    setSaving(prev => ({ ...prev, [u.id]: true }))
    try {
      const updated = await api.updateUser(u.id, { global_role: newRole })
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))
    } catch {
      setEditingRole(prev => ({ ...prev, [u.id]: u.global_role }))
    } finally {
      setSaving(prev => ({ ...prev, [u.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">
        Loading…
      </div>
    )
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-red-600">{error}</div>
  }

  const active   = users.filter(u => u.is_active)
  const inactive = users.filter(u => !u.is_active)

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate('/')}
              className="text-xs text-neutral-400 hover:text-neutral-600 mb-1 block"
            >
              ← Home
            </button>
            <h1 className="text-lg font-bold text-neutral-900">User Management</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{active.length} active · {inactive.length} inactive</p>
          </div>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="rounded bg-scarlet text-white text-xs font-semibold px-4 py-2 hover:opacity-90 transition-opacity"
          >
            {showCreate ? 'Cancel' : '+ New User'}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mb-6 bg-white border border-neutral-200 rounded-lg p-5 space-y-3"
          >
            <p className="text-sm font-semibold text-neutral-800 mb-1">Create new account</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                  Display Name
                </label>
                <input
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-scarlet/40"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-scarlet/40"
                  placeholder="jane@example.mil"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                  Temporary Password
                </label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-scarlet/40"
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-scarlet/40"
                >
                  <option value="assessor">Assessor</option>
                  <option value="observer">Observer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded bg-scarlet text-white text-xs font-semibold px-5 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Active users */}
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Active Users</p>
            <p className="text-[10px] text-neutral-400">{active.length}</p>
          </div>
          {active.length === 0 && (
            <p className="px-4 py-4 text-sm text-neutral-400 italic">No active users.</p>
          )}
          {active.map(u => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUser?.id}
              saving={!!saving[u.id]}
              editingRole={editingRole[u.id] ?? u.global_role}
              onToggleActive={() => handleToggleActive(u)}
              onRoleChange={r => handleRoleChange(u, r)}
            />
          ))}
        </div>

        {/* Inactive users */}
        {inactive.length > 0 && (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden opacity-60">
            <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Inactive / Deactivated</p>
              <p className="text-[10px] text-neutral-400">{inactive.length}</p>
            </div>
            {inactive.map(u => (
              <UserRow
                key={u.id}
                user={u}
                isSelf={false}
                saving={!!saving[u.id]}
                editingRole={editingRole[u.id] ?? u.global_role}
                onToggleActive={() => handleToggleActive(u)}
                onRoleChange={r => handleRoleChange(u, r)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  saving,
  editingRole,
  onToggleActive,
  onRoleChange,
}: {
  user: UserOut
  isSelf: boolean
  saving: boolean
  editingRole: string
  onToggleActive: () => void
  onRoleChange: (role: string) => void
}) {
  const joined = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 last:border-0">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-[11px] font-bold text-neutral-500 shrink-0">
        {user.display_name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-neutral-800 truncate">{user.display_name}</p>
          {isSelf && <span className="text-[9px] font-bold uppercase tracking-wide text-scarlet bg-scarlet/10 rounded px-1">You</span>}
        </div>
        <p className="text-[10px] text-neutral-400 truncate">{user.email} · Joined {joined}</p>
      </div>

      {/* Role selector */}
      <select
        value={editingRole}
        onChange={e => onRoleChange(e.target.value)}
        disabled={isSelf || saving}
        className={`text-[10px] font-semibold rounded px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-scarlet/40 disabled:opacity-60 ${ROLE_COLOR[editingRole] ?? 'bg-neutral-100 text-neutral-500'}`}
      >
        <option value="assessor">Assessor</option>
        <option value="observer">Observer</option>
        <option value="admin">Admin</option>
      </select>

      {/* Active toggle */}
      {!isSelf && (
        <button
          onClick={onToggleActive}
          disabled={saving}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${
            user.is_active
              ? 'border-neutral-200 text-neutral-500 hover:border-red-300 hover:text-red-600'
              : 'border-green-300 text-green-700 hover:bg-green-50'
          }`}
        >
          {saving ? '…' : user.is_active ? 'Deactivate' : 'Reactivate'}
        </button>
      )}
    </div>
  )
}
