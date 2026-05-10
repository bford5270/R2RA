import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { authHeaders } from '../lib/api'
import type { CrosswalkEditorEntry, CrosswalkEditorFull, WicketRef, MetRef } from '../types/crosswalk'
import { CONFIDENCE_OPTIONS, SECTION_LABELS } from '../types/crosswalk'

// ---- Helpers ------------------------------------------------------------

function sectionOf(jtsItem: string) {
  return jtsItem.split('.')[0]
}

function grouped(entries: CrosswalkEditorEntry[]): Array<{ prefix: string; label: string; items: CrosswalkEditorEntry[] }> {
  const map = new Map<string, CrosswalkEditorEntry[]>()
  for (const e of entries) {
    const prefix = sectionOf(e.jts_item)
    if (!map.has(prefix)) map.set(prefix, [])
    map.get(prefix)!.push(e)
  }
  return Array.from(map.entries()).map(([prefix, items]) => ({
    prefix,
    label: SECTION_LABELS[prefix] ?? prefix,
    items,
  }))
}

function confidenceBadge(c: string) {
  if (c === 'high')   return 'bg-green-50 text-green-700'
  if (c === 'medium') return 'bg-yellow-50 text-yellow-700'
  return 'bg-neutral-100 text-neutral-500'
}

// ---- Wicket row editor --------------------------------------------------

interface WicketRowProps {
  w: WicketRef
  onChange: (w: WicketRef) => void
  onRemove: () => void
}

function WicketRow({ w, onChange, onRemove }: WicketRowProps) {
  return (
    <div className="grid grid-cols-[1fr_80px_1fr_auto] gap-1 items-start">
      <input
        value={w.event_code}
        onChange={e => onChange({ ...w, event_code: e.target.value })}
        placeholder="Event code"
        className="rounded border border-neutral-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-scarlet/40"
      />
      <select
        value={w.confidence}
        onChange={e => onChange({ ...w, confidence: e.target.value as WicketRef['confidence'] })}
        className="rounded border border-neutral-200 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-scarlet/40"
      >
        {CONFIDENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        value={w.rationale ?? ''}
        onChange={e => onChange({ ...w, rationale: e.target.value })}
        placeholder="Rationale"
        className="rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-scarlet/40"
      />
      <button
        onClick={onRemove}
        className="text-neutral-300 hover:text-red-500 text-sm font-bold px-1"
        title="Remove"
      >×</button>
    </div>
  )
}

// ---- MET row editor -----------------------------------------------------

interface MetRowProps {
  m: MetRef
  onChange: (m: MetRef) => void
  onRemove: () => void
}

function MetRow({ m, onChange, onRemove }: MetRowProps) {
  return (
    <div className="grid grid-cols-[1fr_80px_1fr_auto] gap-1 items-start">
      <input
        value={m.id}
        onChange={e => onChange({ ...m, id: e.target.value })}
        placeholder="MCT ID (e.g. MCT 4.5.3)"
        className="rounded border border-neutral-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-scarlet/40"
      />
      <select
        value={m.confidence}
        onChange={e => onChange({ ...m, confidence: e.target.value as MetRef['confidence'] })}
        className="rounded border border-neutral-200 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-scarlet/40"
      >
        {CONFIDENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        value={m.rationale ?? ''}
        onChange={e => onChange({ ...m, rationale: e.target.value })}
        placeholder="Rationale"
        className="rounded border border-neutral-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-scarlet/40"
      />
      <button
        onClick={onRemove}
        className="text-neutral-300 hover:text-red-500 text-sm font-bold px-1"
        title="Remove"
      >×</button>
    </div>
  )
}

// ---- Item editor panel --------------------------------------------------

interface ItemEditorProps {
  entry: CrosswalkEditorEntry
  onSaved: (updated: CrosswalkEditorEntry) => void
}

function ItemEditor({ entry, onSaved }: ItemEditorProps) {
  const [wickets, setWickets] = useState<WicketRef[]>(entry.wickets ?? [])
  const [mets, setMets] = useState<MetRef[]>(entry.mets ?? [])
  const [note, setNote] = useState(entry.note ?? '')
  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Reset local state when the selected entry changes
  useEffect(() => {
    setWickets(entry.wickets ?? [])
    setMets(entry.mets ?? [])
    setNote(entry.note ?? '')
    setMsg(null)
  }, [entry.jts_item])

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const updated = await api.crosswalkEditorSave(entry.jts_item, { wickets, mets, note }) as CrosswalkEditorEntry
      onSaved({ ...updated, _overridden: true, _edited_by: null, _edited_at: null })
      setMsg({ ok: true, text: 'Saved.' })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleRevert() {
    if (!confirm('Revert to YAML base? All edits for this item will be lost.')) return
    setReverting(true); setMsg(null)
    try {
      await api.crosswalkEditorRevert(entry.jts_item)
      // Reload from server via onSaved with _overridden=false
      onSaved({ ...entry, _overridden: false, _edited_by: null, _edited_at: null })
      setMsg({ ok: true, text: 'Reverted to YAML base.' })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Revert failed.' })
    } finally {
      setReverting(false)
    }
  }

  function addWicket() {
    setWickets(prev => [...prev, { event_code: '', confidence: 'medium', rationale: '' }])
  }

  function addMet() {
    setMets(prev => [...prev, { id: '', confidence: 'medium', rationale: '' }])
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm font-bold text-neutral-800">{entry.jts_item}</span>
          {entry._overridden && (
            <span className="ml-2 text-[10px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
              edited
            </span>
          )}
        </div>
        {entry._overridden && (
          <button
            onClick={handleRevert}
            disabled={reverting}
            className="text-xs text-neutral-400 hover:text-red-500 disabled:opacity-50"
          >
            {reverting ? 'Reverting…' : 'Revert to base'}
          </button>
        )}
      </div>

      {/* Wickets */}
      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">T&R Wickets</h3>
          <button onClick={addWicket} className="text-[10px] text-scarlet hover:text-scarlet-dark font-semibold">+ Add wicket</button>
        </div>
        {wickets.length === 0 && (
          <p className="text-xs text-neutral-400 italic">No wickets mapped.</p>
        )}
        <div className="space-y-1.5">
          {wickets.map((w, i) => (
            <WicketRow
              key={i}
              w={w}
              onChange={nw => setWickets(prev => prev.map((x, j) => j === i ? nw : x))}
              onRemove={() => setWickets(prev => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        {wickets.length > 0 && (
          <p className="text-[10px] text-neutral-400 mt-1">
            Col order: Event code · Confidence · Rationale
          </p>
        )}
      </section>

      {/* METs */}
      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">MCT METs</h3>
          <button onClick={addMet} className="text-[10px] text-scarlet hover:text-scarlet-dark font-semibold">+ Add MET</button>
        </div>
        {mets.length === 0 && (
          <p className="text-xs text-neutral-400 italic">No METs mapped.</p>
        )}
        <div className="space-y-1.5">
          {mets.map((m, i) => (
            <MetRow
              key={i}
              m={m}
              onChange={nm => setMets(prev => prev.map((x, j) => j === i ? nm : x))}
              onRemove={() => setMets(prev => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </section>

      {/* Note */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">Note (evidence guidance)</h3>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Explain why there's no wicket, or where evidence lives…"
          className="w-full rounded border border-neutral-200 px-3 py-2 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-scarlet/40"
        />
      </section>

      {msg && (
        <p className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-scarlet text-white text-xs font-semibold px-5 py-1.5 hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save mapping'}
      </button>
    </div>
  )
}

// ---- Page ---------------------------------------------------------------

export function CrosswalkEditorPage() {
  const [data, setData] = useState<CrosswalkEditorFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  useEffect(() => {
    api.crosswalkEditorFull()
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleSaved = useCallback((updated: CrosswalkEditorEntry) => {
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        entries: prev.entries.map(e => e.jts_item === updated.jts_item ? updated : e),
      }
    })
  }, [])

  async function handleSetStatus(newStatus: string) {
    setStatusBusy(true)
    try {
      const res = await api.crosswalkEditorSetStatus(newStatus)
      setData(prev => prev ? { ...prev, status: res.status as CrosswalkEditorFull['status'] } : prev)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally {
      setStatusBusy(false)
    }
  }

  function handleExport() {
    const url = api.crosswalkEditorExportUrl()
    fetch(url, { headers: authHeaders() })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'jts_r2__hss_tr.yaml'
        a.click()
      })
  }

  if (loading) return <p className="p-8 text-sm text-neutral-400">Loading…</p>
  if (error)   return <p className="p-8 text-sm text-red-600">{error}</p>
  if (!data)   return null

  const sections = grouped(data.entries)
  const selectedEntry = data.entries.find(e => e.jts_item === selected) ?? null
  const overrideCount = data.entries.filter(e => e._overridden).length

  const statusApproved = data.status === 'approved'

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="border-b border-neutral-200 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-neutral-400 hover:text-neutral-600">← Home</Link>
          <h1 className="text-sm font-bold text-neutral-900">Crosswalk SME Editor</h1>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusApproved ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {data.status}
          </span>
          {overrideCount > 0 && (
            <span className="text-[10px] text-neutral-500">{overrideCount} edited</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSetStatus(statusApproved ? 'draft-needs-sme-review' : 'approved')}
            disabled={statusBusy}
            className={`text-xs font-semibold px-3 py-1.5 rounded border transition-colors disabled:opacity-50 ${
              statusApproved
                ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                : 'border-green-200 text-green-700 hover:bg-green-50'
            }`}
          >
            {statusBusy ? '…' : statusApproved ? 'Reset to draft' : 'Mark approved'}
          </button>
          <button
            onClick={handleExport}
            className="text-xs font-semibold px-3 py-1.5 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Export YAML
          </button>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: item list */}
        <aside className="w-64 border-r border-neutral-200 overflow-y-auto flex-shrink-0">
          {sections.map(sec => (
            <div key={sec.prefix}>
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{sec.label}</p>
              </div>
              {sec.items.map(entry => {
                const hasWickets = (entry.wickets?.length ?? 0) > 0
                const isSelected = selected === entry.jts_item
                return (
                  <button
                    key={entry.jts_item}
                    onClick={() => setSelected(entry.jts_item)}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-1 transition-colors ${
                      isSelected ? 'bg-scarlet/5 border-l-2 border-scarlet' : 'hover:bg-neutral-50 border-l-2 border-transparent'
                    }`}
                  >
                    <span className="font-mono text-xs text-neutral-700 truncate">{entry.jts_item}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {entry._overridden && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Edited" />
                      )}
                      {hasWickets && (
                        <span className="text-[10px] text-neutral-400">{entry.wickets.length}w</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        {/* Right: editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedEntry ? (
            <ItemEditor
              key={selectedEntry.jts_item}
              entry={selectedEntry}
              onSaved={handleSaved}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-sm text-neutral-400">Select a JTS item on the left to edit its T&R mappings.</p>
              <p className="text-xs text-neutral-300 mt-1">{data.entries.length} items · {overrideCount} with edits</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
