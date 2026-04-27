export interface LibraryItem {
  id: string
  unit_id: string
  category: string
  label: string
  description: string | null
  filename: string | null
  content_type: string | null
  hash: string | null
  uploaded_by: string
  uploaded_at: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  roster:    'Roster',
  cert:      'Certification',
  sop:       'SOP / TTP',
  equipment: 'Equipment',
  eval:      'Evaluation',
  other:     'Other',
}

export const CATEGORY_COLOR: Record<string, string> = {
  roster:    'bg-blue-50 text-blue-700',
  cert:      'bg-green-50 text-green-700',
  sop:       'bg-purple-50 text-purple-700',
  equipment: 'bg-orange-50 text-orange-700',
  eval:      'bg-yellow-50 text-yellow-700',
  other:     'bg-neutral-100 text-neutral-500',
}
