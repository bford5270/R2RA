export type MissionType = 'r2lm_non_split' | 'r2lm_split' | 'r2e' | 'arst'
export type AssessmentStatus = 'draft' | 'in_progress' | 'ready_for_review' | 'certified'
export type ResponseStatus = 'yes' | 'no' | 'na' | 'unanswered'

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  r2lm_non_split: 'R2 LM (Non-Split)',
  r2lm_split: 'R2 LM (Split)',
  r2e: 'R2E',
  arst: 'ARST',
}

export interface Assessment {
  id: string
  unit_id: string
  unit_uic: string
  unit_name: string
  mission_type: MissionType
  lead_id: string
  status: AssessmentStatus
  service: string | null
  component: string | null
  unique_identifier: string | null
  started_at: string
  certified_at: string | null
}

export interface SignatureOut {
  id: string
  assessment_id: string
  role: string
  signer_id: string
  print_name: string | null
  method: string
  signed_at: string
  payload_hash: string
}

export interface AssessmentCreate {
  unit_uic: string
  unit_name: string
  mission_type: MissionType
  service?: string
  component?: string
  unique_identifier?: string
}

export interface ItemResponse {
  item_id: string
  status: ResponseStatus
  note: string | null
  capture_data: Record<string, unknown> | null
  authored_by: string
  last_modified_by: string
  version: number
  updated_at: string
}

export interface ResponseUpsert {
  status: ResponseStatus
  note?: string | null
  capture_data?: Record<string, unknown> | null
}

export type TrResponseStatus = 'go' | 'no_go' | 'na' | 'unanswered'

export interface TrResponse {
  event_code: string
  status: TrResponseStatus
  // 1–5 Likert for the overall wicket (null = not yet scored)
  score: number | null
  // {"components": [4, 5, null, 3]} — per-component scores, index-matched to event_components
  capture_data: { components?: (number | null)[] } | null
  note: string | null
  authored_by: string
  last_modified_by: string
  version: number
  updated_at: string
}

export interface TrResponseUpsert {
  status?: TrResponseStatus
  score?: number | null
  note?: string | null
  capture_data?: { components: (number | null)[] } | null
}

// Readiness summary returned by GET /assessments/{id}/readiness-summary
export interface WicketSummary {
  score: number | null
  component_scores: (number | null)[]
  derived_status: 'go' | 'no_go' | 'na' | 'unanswered'
  explicit_score: number | null
}

export interface ChapterSummary {
  mean_score: number | null
  go_count: number
  no_go_count: number
  scored_count: number
  total_count: number
}

export interface JtsFeedForward {
  supporting_wickets: string[]
  mean_score: number | null
  min_score: number | null
  scored_count: number
  total_wickets: number
  suggested_status: 'yes' | 'marginal' | 'no' | null
}

export interface ReadinessSummary {
  wickets: Record<string, WicketSummary>
  chapters: Record<string, ChapterSummary>
  jts_forward: Record<string, JtsFeedForward>
}

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ts: string
}
