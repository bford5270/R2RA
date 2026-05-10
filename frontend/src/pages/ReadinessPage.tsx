import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useManifest } from '@/hooks/useContent'
import type { ReadinessRow, SectionStats } from '../types/reports'
import { MISSION_TYPE_LABELS } from '../types/assessment'

// ---- cell color --------------------------------------------------------

function cellColor(s: SectionStats | undefined): string {
  if (!s) return 'bg-neutral-100'
  const total = s.yes + s.no + s.na + s.unanswered
  if (total === 0) return 'bg-neutral-100'
  const answered = s.yes + s.no + s.na
  const ratio = answered / total
  if (ratio === 0) return 'bg-neutral-100'
  if (s.no > 0 && s.no >= s.yes) return ratio >= 0.8 ? 'bg-red-200' : 'bg-red-100'
  if (ratio >= 0.9) return 'bg-green-200'
  if (ratio >= 0.5) return 'bg-yellow-100'
  return 'bg-yellow-50'
}

function cellTitle(s: SectionStats | undefined): string {
  if (!s) return 'No responses'
  return `YES ${s.yes}  NO ${s.no}  N/A ${s.na}  unanswered ${s.unanswered}`
}

// ---- status badge -------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  draft:             'bg-neutral-100 text-neutral-500',
  in_progress:       'bg-blue-50 text-blue-700',
  ready_for_review:  'bg-yellow-50 text-yellow-700',
  certified:         'bg-green-50 text-green-700',
}

// ---- main ---------------------------------------------------------------

export function ReadinessPage() {
  const { data: manifest } = useManifest()
  const [rows, setRows] = useState<ReadinessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.readinessReport()
      .then(setRows)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const sections = manifest?.sections_manifest ?? []

  // Overall summary stats
  const totalUnits = rows.length
  const certified = rows.filter(r => r.status === 'certified').length
  const inProgress = rows.filter(r => r.status === 'in_progress').length

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/" className="text-xs text-neutral-400 hover:text-neutral-600 mb-1 block">
          ← Home
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-neutral-900">Readiness Dashboard</h1>
            <p className="text-xs text-neutral-400 mt-0.5">Latest assessment per unit · all statuses</p>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-2xl font-bold text-neutral-900">{totalUnits}</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Units</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{certified}</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Certified</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{inProgress}</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wide">In progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-4 text-[10px] text-neutral-500">
        <span className="font-semibold uppercase tracking-wide">Section completion:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-200 inline-block" /> ≥90% answered, mostly YES</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-100 inline-block" /> 50–89% answered</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-50 inline-block" /> &lt;50% answered</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-200 inline-block" /> Many NO answers</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-neutral-100 inline-block" /> Not started</span>
      </div>

      {loading && <p className="text-sm text-neutral-400 py-8 text-center">Loading…</p>}
      {error && <p className="text-sm text-red-600 py-4">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="border border-dashed border-neutral-200 rounded p-8 text-center">
          <p className="text-sm text-neutral-500">No assessments yet.</p>
          <Link to="/assessments/new" className="mt-2 text-sm text-scarlet hover:text-scarlet-dark font-medium block">
            Start the first one →
          </Link>
        </div>
      )}

      {rows.length > 0 && sections.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 bg-neutral-50 border border-neutral-200 font-semibold text-neutral-700 whitespace-nowrap sticky left-0 z-10 min-w-[180px]">
                  Unit
                </th>
                <th className="px-2 py-2 bg-neutral-50 border border-neutral-200 font-semibold text-neutral-600 whitespace-nowrap">
                  Status
                </th>
                <th className="px-2 py-2 bg-neutral-50 border border-neutral-200 font-semibold text-neutral-600 whitespace-nowrap">
                  Answered
                </th>
                {sections.map(s => (
                  <th
                    key={s.id}
                    className="px-1 py-2 bg-neutral-50 border border-neutral-200 font-semibold text-neutral-500 whitespace-nowrap max-w-[60px]"
                    title={s.title}
                  >
                    <span className="block truncate max-w-[56px] font-mono text-[9px] uppercase tracking-wide">
                      {s.item_prefix ?? s.id}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2 bg-neutral-50 border border-neutral-200 font-semibold text-neutral-600 whitespace-nowrap">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const totalItems = row.total_answered + (
                  Object.values(row.by_section).reduce((acc, s) => acc + s.unanswered, 0)
                )
                const pct = totalItems > 0
                  ? Math.round((row.total_answered / totalItems) * 100)
                  : 0

                return (
                  <tr key={row.assessment_id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-2 border border-neutral-200 sticky left-0 bg-white hover:bg-neutral-50 z-10">
                      <Link
                        to={`/assessments/${row.assessment_id}`}
                        className="font-semibold text-neutral-800 hover:text-scarlet block leading-tight"
                      >
                        {row.unit_name}
                      </Link>
                      <span className="text-[9px] text-neutral-400 font-mono">{row.unit_uic}</span>
                      <span className="text-[9px] text-neutral-400 ml-1">
                        · {MISSION_TYPE_LABELS[row.mission_type as keyof typeof MISSION_TYPE_LABELS] ?? row.mission_type}
                      </span>
                    </td>
                    <td className="px-2 py-2 border border-neutral-200 text-center whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[row.status] ?? ''}`}>
                        {row.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-2 py-2 border border-neutral-200 text-center whitespace-nowrap">
                      <span className="font-mono">{pct}%</span>
                      <span className="text-neutral-400 ml-1">({row.total_answered})</span>
                    </td>
                    {sections.map(s => {
                      const stats = s.item_prefix ? row.by_section[s.item_prefix] : undefined
                      return (
                        <td
                          key={s.id}
                          className={`border border-neutral-200 text-center ${cellColor(stats)}`}
                          title={`${s.title}\n${cellTitle(stats)}`}
                        >
                          {stats && (stats.yes + stats.no + stats.na) > 0 ? (
                            <span className="text-[9px] font-mono px-1">
                              {stats.yes + stats.no + stats.na}
                            </span>
                          ) : (
                            <span className="text-neutral-300 text-[9px]">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 border border-neutral-200 text-neutral-400 whitespace-nowrap">
                      {row.certified_at
                        ? <span className="text-green-600 font-semibold">{new Date(row.certified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                        : new Date(row.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Domain breakdown for certified assessments */}
      {rows.some(r => r.status === 'certified') && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">
            Domain gap analysis — certified assessments
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {sections
              .filter(s => s.item_prefix)
              .map(s => {
                const prefix = s.item_prefix!
                const certRows = rows.filter(r => r.status === 'certified' && r.by_section[prefix])
                if (certRows.length === 0) return null
                const totals = certRows.reduce(
                  (acc, r) => {
                    const st = r.by_section[prefix]
                    return {
                      yes: acc.yes + st.yes,
                      no: acc.no + st.no,
                      na: acc.na + st.na,
                      unanswered: acc.unanswered + st.unanswered,
                    }
                  },
                  { yes: 0, no: 0, na: 0, unanswered: 0 },
                )
                const answered = totals.yes + totals.no + totals.na
                const total = answered + totals.unanswered
                const noPct = total > 0 ? Math.round((totals.no / total) * 100) : 0
                const yesPct = total > 0 ? Math.round((totals.yes / total) * 100) : 0

                return (
                  <div key={s.id} className="border border-neutral-200 rounded p-3 bg-white">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 truncate mb-1">
                      {s.title}
                    </p>
                    <div className="flex h-2 rounded overflow-hidden bg-neutral-100">
                      <div className="bg-green-400" style={{ width: `${yesPct}%` }} />
                      <div className="bg-red-400" style={{ width: `${noPct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] text-neutral-400">
                      <span>{totals.yes} YES</span>
                      <span>{totals.no} NO</span>
                      <span>{certRows.length} unit{certRows.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </main>
  )
}
