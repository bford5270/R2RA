export interface UserOut {
  id: string
  display_name: string
  email: string
  global_role: string
}

export interface AssignmentOut {
  id: string
  assessment_id: string
  user_id: string
  display_name: string
  email: string
  role: string
  scope_ids: string[]
  status: string
  assigned_at: string
}

export interface AssignmentUpsert {
  role: string
  scope_ids: string[]
}
