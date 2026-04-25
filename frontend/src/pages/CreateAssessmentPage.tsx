import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { MissionType } from '../types/assessment'
import { MISSION_TYPE_LABELS } from '../types/assessment'

export function CreateAssessmentPage() {
  const navigate = useNavigate()
  const [unitUic, setUnitUic] = useState('')
  const [unitName, setUnitName] = useState('')
  const [missionType, setMissionType] = useState<MissionType>('r2lm_non_split')
  const [service, setService] = useState('')
  const [component, setComponent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const assessment = await api.createAssessment({
        unit_uic: unitUic.trim().toUpperCase(),
        unit_name: unitName.trim(),
        mission_type: missionType,
        service: service.trim() || undefined,
        component: component.trim() || undefined,
      })
      navigate(`/assessments/${assessment.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen p-6 flex items-start justify-center">
      <div className="w-full max-w-lg mt-12">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-neutral-500 hover:text-neutral-700 mb-4 block"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-neutral-900">New Assessment</h1>
          <p className="text-sm text-neutral-500 mt-1">
            JTS Role 2 Readiness Assessment
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={busy} className="space-y-5">

            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Unit</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="uic" className="block text-xs font-semibold text-neutral-600 mb-1">
                    UIC <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="uic"
                    type="text"
                    required
                    placeholder="e.g. 1MARDIV"
                    value={unitUic}
                    onChange={e => setUnitUic(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-scarlet/40 focus:border-scarlet disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="unit-name" className="block text-xs font-semibold text-neutral-600 mb-1">
                    Unit name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="unit-name"
                    type="text"
                    required
                    placeholder="e.g. 1st Medical Battalion"
                    value={unitName}
                    onChange={e => setUnitName(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-scarlet/40 focus:border-scarlet disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="service" className="block text-xs font-semibold text-neutral-600 mb-1">
                    Service
                  </label>
                  <input
                    id="service"
                    type="text"
                    placeholder="e.g. USMC"
                    value={service}
                    onChange={e => setService(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-scarlet/40 focus:border-scarlet disabled:opacity-50"
                  />
                </div>
                <div>
                  <label htmlFor="component" className="block text-xs font-semibold text-neutral-600 mb-1">
                    Component
                  </label>
                  <input
                    id="component"
                    type="text"
                    placeholder="e.g. Active"
                    value={component}
                    onChange={e => setComponent(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-scarlet/40 focus:border-scarlet disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Mission type <span className="text-red-500">*</span>
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MISSION_TYPE_LABELS) as MissionType[]).map(mt => (
                  <label
                    key={mt}
                    className={`flex items-center gap-2 rounded border px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                      missionType === mt
                        ? 'border-scarlet bg-scarlet/5 text-scarlet font-semibold'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mission_type"
                      value={mt}
                      checked={missionType === mt}
                      onChange={() => setMissionType(mt)}
                      className="sr-only"
                    />
                    {MISSION_TYPE_LABELS[mt]}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-600 font-medium">{error}</p>
            )}

            <button
              type="submit"
              className="w-full rounded bg-scarlet text-white text-sm font-semibold px-4 py-2.5 hover:bg-scarlet-dark transition-colors disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create assessment'}
            </button>
          </fieldset>
        </form>
      </div>
    </main>
  )
}
