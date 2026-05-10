export interface Exercise {
  id: string
  name: string
  start_date: string  // ISO date string YYYY-MM-DD
  end_date: string
  location: string | null
  status: 'active' | 'closed'
  created_by: string
  created_at: string
}

export interface ExerciseCreate {
  name: string
  start_date: string
  end_date: string
  location?: string | null
}
