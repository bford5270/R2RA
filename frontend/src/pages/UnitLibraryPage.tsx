import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { authHeaders } from '../lib/api'
import type { LibraryItem } from '../types/library'
import { CATEGORY_LABELS, CATEGORY_COLOR } from '../types/library'

const CATEGORIES = Object.entries(CATEGORY_LABELS)

function fileIcon(contentType: string | null): string {
  if (!contentType) return '📄'
  if (contentType.startsWith('image/')) return '🖼️'
  if (contentType === 'application/pdf') return '📋'
  return '📄'
}

function ItemRow({
  item,
  uic,
  onDeleted,
}: {
  item: LibraryItem
  uic: string
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${item.label}"?`)) return
    setDeleting(true)
    try {
      await api.deleteLibraryItem(uic, item.id)
      onDeleted(item.id)
    } catch {
      setDeleting(false)
    }
  }

  const fileUrl = api.libraryFileUrl(uic, item.id)
  const date = new Date(item.uploaded_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-neutral-100 last:border-0">
      <span className="text-lg shrink-0 mt-0.5">{fileIcon(item.content_type)}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            // authenticated fetch via headers not possible on <a>; redirect through window.fetch
            onClick={async e => {
              e.preventDefault()
              const res = await fetch(fileUrl, { headers: authHeaders() })
              if (!res.ok) return
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              window.open(url, '_blank')
              setTimeout(() => URL.revokeObjectURL(url), 10_000)
            }}
            className="text-sm font-semibold text-neutral-800 hover:text-scarlet truncate"
          >
            {item.label}
          </a>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CATEGORY_COLOR[item.category] ?? 'bg-neutral-100 text-neutral-500'}`}>
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>
        )}
        <p className="text-[10px] text-neutral-400 mt-0.5">
          {item.filename} · {date}
          {item.hash && (
            <span className="font-mono ml-1" title={item.hash}> · {item.hash.slice(0, 12)}…</span>
          )}
        </p>
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-[10px] text-neutral-300 hover:text-red-500 shrink-0 disabled:opacity-50 transition-colors"
        title="Delete"
      >
        {deleting ? '…' : '✕'}
      </button>
    </div>
  )
}

export function UnitLibraryPage() {
  const { uic } = useParams<{ uic: string }>()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unitName, setUnitName] = useState<string>('')

  // Upload form state
  const [showUpload, setShowUpload] = useState(false)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('other')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Filter
  const [filterCat, setFilterCat] = useState<string>('all')

  useEffect(() => {
    if (!uic) return
    api.listLibrary(uic)
      .then(data => {
        setItems(data)
        if (data.length > 0) setUnitName('')  // unit name comes from assessment context
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [uic])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !uic) return
    setUploading(true)
    setUploadError(null)
    try {
      const created = await api.uploadLibraryItem(uic, file, label, category, description)
      setItems(prev => [created, ...prev])
      setShowUpload(false)
      setLabel(''); setCategory('other'); setDescription(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const filtered = filterCat === 'all' ? items : items.filter(i => i.category === filterCat)
  const countsByCategory = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1
    return acc
  }, {})

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link to="/" className="text-xs text-neutral-400 hover:text-neutral-600 mb-1 block">
          ← Home
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              Unit Evidence Library
              {unitName && <span className="text-neutral-500 font-normal"> — {unitName}</span>}
            </h1>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">{uic}</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              Standing documents reused across assessments — {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowUpload(v => !v)}
            className="rounded bg-scarlet text-white text-xs font-semibold px-4 py-2 hover:opacity-90 transition-opacity"
          >
            {showUpload ? 'Cancel' : '+ Upload'}
          </button>
        </div>
      </div>

      {/* Upload form */}
      {showUpload && (
        <form
          onSubmit={handleUpload}
          className="mb-6 bg-white border border-neutral-200 rounded-lg p-5 space-y-3"
        >
          <p className="text-sm font-semibold text-neutral-800">Add document</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Label *
              </label>
              <input
                required
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Provider Roster Q1 2026"
                className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-scarlet/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-scarlet/40"
              >
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                File *
              </label>
              <input
                ref={fileRef}
                required
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Description (optional)
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief notes about this document"
                className="w-full rounded border border-neutral-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-scarlet/40"
              />
            </div>
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded bg-scarlet text-white text-xs font-semibold px-5 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-neutral-400 py-8 text-center">Loading…</p>}
      {error && <p className="text-sm text-red-600 py-4">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="border border-dashed border-neutral-200 rounded p-8 text-center">
          <p className="text-sm text-neutral-500">No documents yet.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-2 text-sm text-scarlet hover:text-scarlet-dark font-medium"
          >
            Upload the first one →
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Category filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <button
              onClick={() => setFilterCat('all')}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${filterCat === 'all' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
            >
              All ({items.length})
            </button>
            {CATEGORIES.filter(([v]) => countsByCategory[v]).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilterCat(v)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${filterCat === v ? 'bg-neutral-800 text-white' : `${CATEGORY_COLOR[v]} hover:opacity-80`}`}
              >
                {l} ({countsByCategory[v]})
              </button>
            ))}
          </div>

          <div className="border border-neutral-200 rounded bg-white">
            {filtered.length === 0 && (
              <p className="px-4 py-4 text-sm text-neutral-400 italic">No items in this category.</p>
            )}
            {filtered.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                uic={uic!}
                onDeleted={id => setItems(prev => prev.filter(i => i.id !== id))}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
