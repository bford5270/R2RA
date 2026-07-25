import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Assessment, Debrief, DebriefDistilled, DistilledItem } from '../types/assessment'

/**
 * Debrief recorder + AI distillation.
 *
 * The lead records the team debrief in the app (MediaRecorder). Audio is
 * uploaded, transcribed with Amazon Transcribe, and distilled by Claude on
 * Bedrock into sustains / opportunities for growth / next-time actions.
 * The lead edits the draft, then commits it — committed debriefs appear on
 * the AAR. Raw audio is deleted once distillation succeeds.
 */

const SECTION_META: { key: keyof Pick<DebriefDistilled, 'sustains' | 'improves' | 'next_time'>; label: string; color: string; bg: string }[] = [
  { key: 'sustains', label: 'Sustains — what went well', color: 'var(--signal-green)', bg: 'rgba(107,127,79,0.10)' },
  { key: 'improves', label: 'Opportunities for growth', color: 'var(--signal-amber)', bg: 'rgba(201,154,46,0.10)' },
  { key: 'next_time', label: 'For next time', color: 'var(--signal-blue)', bg: 'rgba(91,122,139,0.10)' },
]

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

// ---------------------------------------------------------------------------
// Recorder
// ---------------------------------------------------------------------------

function Recorder({ onRecorded }: { onRecorded: (blob: Blob, mime: string, durationSec: number) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'error'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickMimeType()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const type = rec.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const dur = Math.round((Date.now() - startedAtRef.current) / 1000)
        onRecorded(blob, type, dur)
      }
      rec.start(1000) // gather chunks every second
      recorderRef.current = rec
      startedAtRef.current = Date.now()
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
      setState('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone unavailable')
      setState('error')
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current)
    recorderRef.current?.stop()
    setState('idle')
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }, [])

  if (state === 'recording') {
    return (
      <div className="rounded-lg border-2 p-4" style={{ borderColor: 'var(--signal-red)', background: 'rgba(179,58,58,0.08)' }}>
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full animate-pulse shrink-0" style={{ background: 'var(--signal-red)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--signal-red)' }}>
              RECORDING IN PROGRESS · {fmtDuration(elapsed)}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
              Everyone in the room should be aware this debrief is being recorded.
            </p>
          </div>
          <button
            onClick={stop}
            className="rounded px-5 py-2.5 text-sm font-bold border-2 min-h-[44px]"
            style={{ borderColor: 'var(--signal-red)', color: 'var(--signal-red)', background: 'var(--surface-1)' }}
          >
            ■ Stop
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={start}
        className="rounded px-5 py-3 text-sm font-bold min-h-[44px]"
        style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
      >
        ● Record debrief
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Distilled editor
// ---------------------------------------------------------------------------

function DistilledEditor({
  debrief,
  isLead,
  onChanged,
}: {
  debrief: Debrief
  isLead: boolean
  onChanged: (d: Debrief) => void
}) {
  const [draft, setDraft] = useState<DebriefDistilled>(
    debrief.distilled ?? { sustains: [], improves: [], next_time: [], summary: '' }
  )
  const [showTranscript, setShowTranscript] = useState(false)
  const [busy, setBusy] = useState<'save' | 'commit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locked = debrief.status === 'committed' || !isLead

  function setItems(key: 'sustains' | 'improves' | 'next_time', items: DistilledItem[]) {
    setDraft(prev => ({ ...prev, [key]: items }))
  }

  async function save() {
    setBusy('save')
    setError(null)
    try {
      onChanged(await api.updateDebrief(debrief.id, { distilled: draft }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  async function commit() {
    if (!window.confirm('Commit this debrief? It becomes read-only and appears on the AAR.')) return
    setBusy('commit')
    setError(null)
    try {
      const saved = await api.updateDebrief(debrief.id, { distilled: draft })
      onChanged(await api.commitDebrief(saved.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 mt-3">
      {draft.summary && (
        <p className="text-xs italic rounded border border-neutral-300 bg-neutral-100 p-3" style={{ color: 'var(--ink-2)' }}>
          {draft.summary}
        </p>
      )}

      {SECTION_META.map(({ key, label, color, bg }) => (
        <div key={key} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-1)', background: bg }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>{label}</p>
          {draft[key].length === 0 && (
            <p className="text-[11px] italic text-neutral-400 mb-2">None captured.</p>
          )}
          {draft[key].map((item, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <span className="text-xs mt-2 shrink-0" style={{ color }}>•</span>
              <div className="flex-1 min-w-0">
                <textarea
                  value={item.text}
                  disabled={locked}
                  onChange={e => setItems(key, draft[key].map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  rows={2}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs bg-white/70 focus:outline-none focus:ring-1 focus:ring-amber-500/40 disabled:bg-transparent disabled:border-transparent disabled:resize-none"
                />
                <input
                  type="text"
                  value={item.event_codes.join(', ')}
                  disabled={locked}
                  onChange={e => setItems(key, draft[key].map((x, j) => (j === i ? { ...x, event_codes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x)))}
                  placeholder="Related wickets (e.g. HSS-OPS-7001)"
                  className="w-full mt-1 rounded border border-neutral-200 px-2 py-1 text-[10px] font-mono bg-white/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40 disabled:hidden"
                />
                {locked && item.event_codes.length > 0 && (
                  <p className="text-[10px] font-mono text-neutral-500 mt-0.5">{item.event_codes.join(' · ')}</p>
                )}
              </div>
              {!locked && (
                <button
                  onClick={() => setItems(key, draft[key].filter((_, j) => j !== i))}
                  className="text-neutral-400 hover:text-red-600 text-sm px-1 shrink-0"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {!locked && (
            <button
              onClick={() => setItems(key, [...draft[key], { text: '', event_codes: [] }])}
              className="text-[10px] font-semibold underline"
              style={{ color }}
            >
              + Add item
            </button>
          )}
        </div>
      ))}

      {debrief.transcript && (
        <div>
          <button
            onClick={() => setShowTranscript(v => !v)}
            className="text-[11px] text-neutral-400 hover:text-neutral-600 underline"
          >
            {showTranscript ? 'Hide transcript' : 'Show full transcript'}
          </button>
          {showTranscript && (
            <p className="mt-2 text-[11px] leading-relaxed whitespace-pre-wrap rounded border border-neutral-300 bg-neutral-100 p-3 max-h-64 overflow-y-auto" style={{ color: 'var(--ink-2)' }}>
              {debrief.transcript}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!locked && (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy !== null}
            className="rounded border-2 px-4 py-2 text-xs font-bold disabled:opacity-50"
            style={{ borderColor: 'var(--border-1)', color: 'var(--ink-1)' }}
          >
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={commit}
            disabled={busy !== null}
            className="rounded bg-scarlet text-white px-4 py-2 text-xs font-bold hover:bg-scarlet-dark disabled:opacity-50"
          >
            {busy === 'commit' ? 'Committing…' : 'Commit to AAR →'}
          </button>
          <span className="text-[10px] text-neutral-400">The AI drafts — you sign.</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<Debrief['status'], string> = {
  uploaded: 'Uploaded — not processed',
  transcribing: 'Transcribing…',
  distilling: 'Distilling with AI…',
  ready: 'Ready for review',
  committed: '✓ Committed to AAR',
  failed: 'Processing failed',
}

export function DebriefPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const { user } = useAuth()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [debriefs, setDebriefs] = useState<Debrief[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualText, setManualText] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const isLead = assessment !== null && (assessment.lead_id === user?.id || user?.global_role === 'admin')

  const refresh = useCallback(() => {
    if (!assessmentId) return
    api.listDebriefs(assessmentId).then(setDebriefs).catch(() => {/* keep last */})
  }, [assessmentId])

  useEffect(() => {
    if (!assessmentId) return
    Promise.all([api.getAssessment(assessmentId), api.listDebriefs(assessmentId)])
      .then(([a, ds]) => { setAssessment(a); setDebriefs(ds) })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load'))
  }, [assessmentId])

  // Poll while anything is processing
  const processing = debriefs.some(d => d.status === 'transcribing' || d.status === 'distilling')
  useEffect(() => {
    if (!processing) return
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [processing, refresh])

  async function handleRecorded(blob: Blob, mime: string, durationSec: number) {
    if (!assessmentId) return
    setUploading(true)
    setActionError(null)
    try {
      const ext = mime.includes('mp4') ? 'm4a' : 'webm'
      const title = `Team debrief — ${new Date().toLocaleDateString()}`
      const created = await api.uploadDebrief(assessmentId, blob, `debrief.${ext}`, title, durationSec)
      setDebriefs(prev => [created, ...prev])
      if (created.transcription_available) {
        const started = await api.processDebrief(created.id)
        setDebriefs(prev => prev.map(d => (d.id === started.id ? started : d)))
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    if (!assessmentId || !manualText.trim()) return
    setUploading(true)
    setActionError(null)
    try {
      const created = await api.createManualDebrief(
        assessmentId,
        `Team debrief — ${new Date().toLocaleDateString()}`,
        manualText.trim()
      )
      const started = await api.processDebrief(created.id)
      setDebriefs(prev => [started, ...prev])
      setManualText('')
      setShowManual(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create debrief')
    } finally {
      setUploading(false)
    }
  }

  async function handleRetry(d: Debrief) {
    try {
      const started = await api.processDebrief(d.id)
      setDebriefs(prev => prev.map(x => (x.id === started.id ? started : x)))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Retry failed')
    }
  }

  async function handleDelete(d: Debrief) {
    if (!window.confirm(`Delete "${d.title}"?`)) return
    await api.deleteDebrief(d.id)
    setDebriefs(prev => prev.filter(x => x.id !== d.id))
  }

  if (loadError) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-red-600">{loadError}</div>
  }
  if (!assessment) {
    return <div className="flex items-center justify-center min-h-screen text-sm text-neutral-400">Loading…</div>
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <Link to={`/assessments/${assessmentId}/tr`} className="text-xs text-neutral-400 hover:text-neutral-600">
          ← T&R Assessment
        </Link>
        <h1 className="font-display text-xl font-bold text-neutral-900 mt-1">Team Debrief</h1>
        <p className="text-xs text-neutral-500 mb-5">
          {assessment.unit_name} · Record the debrief, and the app transcribes it and distills
          opportunities for growth. You review and commit the result to the AAR.
        </p>

        {isLead ? (
          <div className="space-y-3 mb-6">
            {uploading ? (
              <p className="text-sm text-neutral-500">Uploading recording…</p>
            ) : (
              <Recorder onRecorded={handleRecorded} />
            )}
            <button
              onClick={() => setShowManual(v => !v)}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 underline"
            >
              {showManual ? 'Cancel manual transcript' : 'Or paste a transcript instead'}
            </button>
            {showManual && (
              <form onSubmit={handleManual} className="space-y-2">
                <textarea
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  rows={6}
                  placeholder="Paste or type the debrief notes/transcript here…"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-xs bg-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                />
                <button
                  type="submit"
                  disabled={uploading || !manualText.trim()}
                  className="rounded bg-scarlet text-white text-xs font-bold px-4 py-2 disabled:opacity-40"
                >
                  Distill this transcript
                </button>
              </form>
            )}
            {actionError && <p className="text-xs text-red-600">{actionError}</p>}
          </div>
        ) : (
          <p className="text-xs text-neutral-400 mb-6 italic">
            Only the lead assessor records and manages debriefs. Committed debriefs appear on the AAR.
          </p>
        )}

        {/* Debrief list */}
        <div className="space-y-4">
          {debriefs.length === 0 && (
            <div className="border border-dashed border-neutral-300 rounded p-8 text-center">
              <p className="text-sm text-neutral-500">No debriefs yet.</p>
            </div>
          )}
          {debriefs.map(d => (
            <div key={d.id} className="rounded-lg border border-neutral-300 bg-white p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-neutral-800 flex-1 min-w-0">{d.title}</p>
                <span
                  className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5"
                  style={
                    d.status === 'committed'
                      ? { background: 'rgba(107,127,79,0.22)', color: 'var(--signal-green)' }
                      : d.status === 'failed'
                      ? { background: 'rgba(179,58,58,0.18)', color: 'var(--signal-red)' }
                      : d.status === 'ready'
                      ? { background: 'rgba(201,154,46,0.20)', color: 'var(--signal-amber)' }
                      : { background: 'rgba(91,122,139,0.22)', color: 'var(--signal-blue)' }
                  }
                >
                  {STATUS_LABEL[d.status]}
                </span>
                {isLead && d.status !== 'committed' && (
                  <button
                    onClick={() => handleDelete(d)}
                    className="text-[10px] text-neutral-400 hover:text-red-600 underline"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {new Date(d.created_at).toLocaleString()}
                {d.duration_sec !== null && <> · {fmtDuration(d.duration_sec)} recorded</>}
                {d.has_audio === false && d.transcript && d.status !== 'uploaded' && <> · audio deleted after transcription</>}
              </p>

              {(d.status === 'transcribing' || d.status === 'distilling') && (
                <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--signal-blue)' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--signal-blue)' }} />
                  {d.status === 'transcribing' ? 'Transcribing audio — this can take a few minutes…' : 'Claude is distilling the debrief…'}
                </div>
              )}

              {d.status === 'failed' && (
                <div className="mt-3">
                  <p className="text-xs text-red-600">{d.error ?? 'Processing failed.'}</p>
                  {isLead && (
                    <button onClick={() => handleRetry(d)} className="mt-1 text-xs font-semibold text-scarlet underline">
                      Retry processing
                    </button>
                  )}
                </div>
              )}

              {d.status === 'uploaded' && isLead && d.transcription_available && (
                <button onClick={() => handleRetry(d)} className="mt-2 text-xs font-semibold text-scarlet underline">
                  Start processing
                </button>
              )}

              {(d.status === 'ready' || d.status === 'committed') && (
                <DistilledEditor
                  debrief={d}
                  isLead={isLead}
                  onChanged={u => setDebriefs(prev => prev.map(x => (x.id === u.id ? u : x)))}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
