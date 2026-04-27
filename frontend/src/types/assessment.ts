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
  note: string | null
  authored_by: string
  last_modified_by: string
  version: number
  updated_at: string
}

export interface TrResponseUpsert {
  status: TrResponseStatus
  note?: string | null
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
