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
  scenario_ref: string | null
  exercise_id: string | null
  tr_evaluator_name: string | null
  tr_evaluator_rank: string | null
  tr_evaluator_billet: string | null
  tr_aar_narrative: string | null
  tr_aar_priorities: string | null
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
  scenario_ref?: string | null
  exercise_id?: string | null
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
  score: number | null
  capture_data: {
    components?: (number | null)[]
    component_notes?: string[]
    sustains?: string
    improves?: string
    corrective_action?: string
    corrective_action_suspense?: string
    corrective_action_owner?: string
  } | null
  note: string | null
  conducted_on: string | null
  conditions_met: boolean | null
  headcount: number | null
  authored_by: string
  last_modified_by: string
  version: number
  updated_at: string
}

export interface TrResponseUpsert {
  status?: TrResponseStatus
  score?: number | null
  note?: string | null
  capture_data?: Record<string, unknown> | null
  conducted_on?: string | null
  conditions_met?: boolean | null
  headcount?: number | null
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

export interface TrJtsEvidenceItem {
  item_id: string
  confidence: 'high' | 'medium' | 'low'
  rationale: string
  status: 'yes' | 'no' | 'na' | 'unanswered'
  note: string | null
}

export interface TrJtsEvidence {
  items: TrJtsEvidenceItem[]
  signal: 'go' | 'no_go' | 'mixed' | 'unanswered'
  yes_count: number
  no_count: number
  answered_count: number
  total_count: number
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

// ---- T&R evaluator taskings (S3T assigns PECLs/METs to evaluators) ----

export type TrTaskingStatus = 'assigned' | 'returned'

export interface TrTasking {
  id: string
  assessment_id: string
  user_id: string
  display_name: string
  email: string
  event_codes: string[]
  mets: string[]
  note: string | null
  status: TrTaskingStatus
  assigned_at: string
  returned_at: string | null
}

export interface MyTrTasking {
  id: string
  assessment_id: string
  unit_name: string
  unit_uic: string
  exercise_name: string | null
  event_codes: string[]
  mets: string[]
  note: string | null
  status: TrTaskingStatus
  assigned_at: string
  returned_at: string | null
  scored_count: number
}

export interface TrTaskingUpsert {
  event_codes: string[]
  mets: string[]
  note: string | null
}

// ---- scenario cases (role2builder) + learning-objective feedback ----

export interface CasePersonnel {
  name: string
  role: string
}

export type CasePhase = 'poi' | 'triage' | 'trauma_bay' | 'or' | 'postop' | 'evac' | 'other'

export interface CaseJourneyEntry {
  phase: CasePhase
  phase_label: string | null
  time: string | null
  notes: string | null
  personnel: CasePersonnel[]
}

export interface ScenarioCase {
  id: string
  assessment_id: string
  label: string
  source_ref: string | null
  event_codes: string[]
  journey: CaseJourneyEntry[]
  personnel: CasePersonnel[]
  filename: string
  content_type: string
  hash: string
  uploaded_by: string
  uploaded_at: string
}

export interface LoFeedback {
  id: string
  assessment_id: string
  event_code: string
  case_id: string | null
  rating: number | null
  recommendation: 'keep' | 'change' | 'drop' | null
  comment: string | null
  created_by: string
  author_name: string
  updated_at: string
}

export interface LoFeedbackUpsert {
  rating: number | null
  recommendation: 'keep' | 'change' | 'drop' | null
  comment: string | null
  case_id: string | null
}

// ---- debriefs (recorded, AI-distilled) ----

export interface DistilledItem {
  text: string
  event_codes: string[]
}

export interface DebriefDistilled {
  sustains: DistilledItem[]
  improves: DistilledItem[]
  next_time: DistilledItem[]
  summary?: string
}

export type DebriefStatus =
  | 'uploaded'
  | 'transcribing'
  | 'distilling'
  | 'ready'
  | 'committed'
  | 'failed'

export interface Debrief {
  id: string
  assessment_id: string
  title: string
  status: DebriefStatus
  has_audio: boolean
  duration_sec: number | null
  transcript: string | null
  distilled: DebriefDistilled | null
  error: string | null
  created_by: string
  created_at: string
  updated_at: string
  committed_at: string | null
  transcription_available: boolean
}
