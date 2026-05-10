export interface SectionStats {
  yes: number
  no: number
  na: number
  unanswered: number
}

export interface ReadinessRow {
  unit_uic: string
  unit_name: string
  assessment_id: string
  status: string
  mission_type: string
  started_at: string
  certified_at: string | null
  total_answered: number
  total_yes: number
  total_no: number
  total_na: number
  by_section: Record<string, SectionStats>
}
