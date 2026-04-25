export interface WicketRef {
  event_code: string
  confidence: 'high' | 'medium' | 'low'
  rationale: string
}

export interface MetRef {
  mct_task: string
  confidence: 'high' | 'medium' | 'low'
}

export interface CrosswalkEntry {
  jts_item: string
  wickets: WicketRef[]
  mets?: MetRef[]
}
