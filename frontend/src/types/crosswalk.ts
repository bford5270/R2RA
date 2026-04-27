export interface WicketRef {
  event_code: string
  confidence: 'high' | 'medium' | 'low'
  rationale?: string
}

export interface MetRef {
  id: string
  confidence: 'high' | 'medium' | 'low'
  rationale?: string
}

export interface CrosswalkEntry {
  jts_item: string
  wickets: WicketRef[]
  mets?: MetRef[]
  note?: string
}

// ---- SME editor types ------------------------------------------------

export interface CrosswalkEditorEntry extends CrosswalkEntry {
  _overridden: boolean
  _edited_by: string | null
  _edited_at: string | null
}

export interface CrosswalkEditorFull {
  status: 'draft-needs-sme-review' | 'approved'
  entries: CrosswalkEditorEntry[]
}

export const CONFIDENCE_OPTIONS: Array<{ value: 'high' | 'medium' | 'low'; label: string }> = [
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

export const SECTION_LABELS: Record<string, string> = {
  pdp:   'Predeployment Prep',
  c2:    'Command & Control',
  mroe:  'Med Rules of Engagement',
  comms: 'Communications',
  orsop: 'OR/SOP',
  cra:   'Clinical Readiness',
  cc:    'Clinical Capabilities',
  blood: 'Blood Resources',
  fac:   'Facilities',
  arsra: 'ARSRA Appendix',
}
