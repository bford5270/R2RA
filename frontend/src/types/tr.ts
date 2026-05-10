export interface TrMet {
  id: string
  description: string
}

export interface TrWicket {
  event_code: string
  title: string
  description?: string
  condition?: string
  standard?: string
  event_components?: string[]
  mets_extracted?: TrMet[]
  evaluation_coded?: boolean
  readiness_coded?: boolean
  community?: string
  chapter: number
  provenance: { source_page: number }
}

export interface TrChapter {
  number: number
  title: string
}

export interface TrFramework {
  framework_id: string
  version: string
  title: string
  chapters: TrChapter[]
  wickets: TrWicket[]
}
