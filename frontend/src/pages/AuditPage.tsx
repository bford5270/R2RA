import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { AuditLogEntry } from '../types/assessment'

const ACTION_LABELS: Record<string, string> = {
  'response.upsert':    'Response saved',
  'tr_response.upsert': 'T&R response saved',
  'assessment.status':  'Status changed',
  'assignment.upsert':  'Assignment updated',
  'assignment.delete':  'Assignment removed',
}

function actionBadgeClass(action: string): string {
  if (action === 'assessment.status') return 'bg-yellow-50 text-yellow-700'
  if (action.startsWith('assignment')) return 'bg-purple-50 text-purple-700'
  if (action.startsWith('tr_response')) return 'bg-blue-50 text-blue-700'
  return 'bg-neutral-100 text-neutral-600'
}

function DiffLine({ label, val }: { label: string; val: unknown }) {
  if (val === undefined || val === null) return null
  const display = typeof val === 'object' ? JSON.stringify(val) : String(val)
  return (
    <span className="inline-flex items-center gap-1 mr-2">
      <span className="text-neutral-400">{label}:</span>
      <span className="font-mono">{display}</span>
    </span>
  )
}

function EntryRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const ts = new Date(entry.ts)
  const timeStr = ts.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })

  const beforeAfterFields = Array.from(
    new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})])
  )

  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-neutral-50 transition-colors"
      >
        <span className="text-[10px] text-neutral-400 font-mono mt-0.5 shrink-0 w-36">{timeStr}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${actionBadgeClass(entry.action)}`}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </span>
        <span className="text-[11px] text-neutral-500 truncate flex-1">
          {beforeAfterFields.map(k => (
            <DiffLine
              key={k}
              label={k}
              val={entry.after?.[k] ?? entry.before?.[k]}
            />
          ))}
        </span>
        <span className="text-neutral-300 shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 pt-0 bg-neutral-50 font-mono text-[10px] space-y-1">
          <p className="text-neutral-400">entity: {entry.entity_id}</p>
          {entry.actor_id && <p className="text-neutral-400">actor: {entry.actor_id}</p>}
          {entry.before && (
            <div className="flex gap-2">
              <span className="text-red-400 shrink-0">before:</span>
              <pre className="text-neutral-600 whitespace-pre-wrap break-all">{JSON.stringify(entry.before, null, 2)}</pre>
            </div>
          )}
          {entry.after && (
            <div className="flex gap-2">
              <span className="text-green-500 shrink-0">after:</span>
              <pre className="text-neutral-600 whitespace-pre-wrap break-all">{JSON.stringify(entry.after, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AuditPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assessmentId) return
    api.listAuditLog(assessmentId)
      .then(setEntries)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [assessmentId])

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          to={`/assessments/${assessmentId}`}
          className="text-xs text-neutral-400 hover:text-neutral-600 mb-1 block"
        >
          ← Assessment
        </Link>
        <h1 className="text-lg font-bold text-neutral-900">Audit Log</h1>
        <p className="text-xs text-neutral-400 mt-0.5">Hash-chained record of all mutations — most recent first</p>
      </div>

      {loading && <p className="text-sm text-neutral-400 py-8 text-center">Loading…</p>}
      {error && <p className="text-sm text-red-600 py-4">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <div className="border border-dashed border-neutral-200 rounded p-8 text-center">
          <p className="text-sm text-neutral-500">No audit entries yet.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="border border-neutral-200 rounded bg-white">
          <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Activity</p>
            <p className="text-[10px] text-neutral-400">{entries.length} entries</p>
          </div>
          {entries.map(e => <EntryRow key={e.id} entry={e} />)}
        </div>
      )}
    </main>
  )
}
