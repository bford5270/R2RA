import { useEffect, useRef, useState } from 'react'
import { api, authHeaders } from '../lib/api'
import type { EvidenceItem } from '../types/evidence'

// Fetches a protected file and returns a revocable blob URL.
function useAuthBlobUrl(evidenceId: string) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let blobUrl: string | null = null
    fetch(`/api/evidence/${evidenceId}/file`, { headers: authHeaders() })
      .then(r => r.blob())
      .then(blob => { blobUrl = URL.createObjectURL(blob); setUrl(blobUrl) })
      .catch(() => setUrl(null))
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [evidenceId])
  return url
}

function EvidenceRow({
  ev,
  onDelete,
}: {
  ev: EvidenceItem
  onDelete: (id: string) => void
}) {
  const isImage = ev.content_type.startsWith('image/')
  const blobUrl = useAuthBlobUrl(ev.id)
  const [deleting, setDeleting] = useState(false)

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = ev.filename
    a.click()
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-neutral-100 last:border-0">
      {isImage && blobUrl ? (
        <img
          src={blobUrl}
          alt={ev.filename}
          className="w-10 h-10 rounded object-cover shrink-0 border border-neutral-200 cursor-pointer"
          onClick={handleDownload}
          title="Click to download"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-neutral-100 border border-neutral-200 shrink-0 flex items-center justify-center text-neutral-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] text-neutral-700 truncate cursor-pointer hover:underline"
          title={ev.filename}
          onClick={handleDownload}
        >
          {ev.filename}
        </p>
        <p className="text-[9px] text-neutral-400">
          {ev.content_type.split('/')[1]?.toUpperCase() ?? ev.type}
        </p>
      </div>
      <button
        type="button"
        disabled={deleting}
        onClick={async () => { setDeleting(true); onDelete(ev.id) }}
        className="text-neutral-300 hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
        title="Remove attachment"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel (lazy-loads evidence list when first opened)
// ---------------------------------------------------------------------------

interface Props {
  assessmentId: string
  itemId: string
}

export function EvidencePanel({ assessmentId, itemId }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    api.listEvidence(assessmentId, itemId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [assessmentId, itemId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setError(null)
    try {
      const ev = await api.uploadEvidence(assessmentId, itemId, file)
      setItems(prev => [...prev, ev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(evidenceId: string) {
    try {
      await api.deleteEvidence(assessmentId, itemId, evidenceId)
      setItems(prev => prev.filter(e => e.id !== evidenceId))
    } catch {
      // leave item in list if delete failed
    }
  }

  return (
    <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
          Attachments {items.length > 0 && `(${items.length})`}
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="text-[10px] text-scarlet hover:opacity-80 disabled:opacity-40 font-medium"
        >
          {uploading ? 'Uploading…' : '+ Attach file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {error && <p className="text-[10px] text-red-500 mb-1">{error}</p>}
      {loading && <p className="text-[10px] text-neutral-400">Loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-[10px] text-neutral-400 italic">No attachments yet.</p>
      )}
      {items.map(ev => (
        <EvidenceRow key={ev.id} ev={ev} onDelete={handleDelete} />
      ))}
    </div>
  )
}
