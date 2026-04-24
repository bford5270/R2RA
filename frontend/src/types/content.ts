export interface CaptureField {
  id: string
  label: string
  type: 'text_short' | 'text_long' | 'number' | 'date'
}

export interface BinaryItem {
  id: string
  type: 'binary'
  prompt: string
  capture?: CaptureField[]
  visible_when?: Record<string, string>
}

export interface TextLongItem {
  id: string
  type: 'text_long'
  label: string
  visible_when?: Record<string, string>
}

export interface TableColumn {
  id: string
  label: string
  type?: 'number' | 'text_short' | 'yn_na'
}

export interface TableRow {
  id: string
  label: string
}

export interface TableCountsItem {
  id: string
  type: 'table_counts'
  label: string
  columns: TableColumn[]
  rows: TableRow[]
  visible_when?: Record<string, string>
}

export interface TableYnItem {
  id: string
  type: 'table_yn'
  label: string
  columns: TableColumn[]
  rows: TableRow[]
  visible_when?: Record<string, string>
}

export interface GroupItem {
  id: string
  type: 'group'
  label: string
  sub_items: AssessmentItem[]
  visible_when?: Record<string, string>
}

export interface SelectOneItem {
  id: string
  type: 'select_one'
  prompt: string
  options: Array<{ value: string; label: string }>
  visible_when?: Record<string, string>
}

export type AssessmentItem =
  | BinaryItem
  | TextLongItem
  | TableCountsItem
  | TableYnItem
  | GroupItem
  | SelectOneItem

export interface Section {
  id: string
  ordinal: number | string
  title: string
  items: AssessmentItem[]
  sections?: Section[]
}

export interface SectionManifestEntry {
  id: string
  ordinal: number
  file: string
  visible_when?: Record<string, string>
}

export interface Variable {
  id: string
  label: string
  type: 'text_short' | 'select_one'
  required?: boolean
  options?: Array<{ value: string; label: string; description?: string; triggers?: string[] }>
}

export interface Manifest {
  framework_id: string
  version: string
  title: string
  subtitle: string
  preamble: string
  variables: Variable[]
  sections_manifest: SectionManifestEntry[]
}
