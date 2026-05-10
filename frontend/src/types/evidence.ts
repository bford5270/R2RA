export interface EvidenceItem {
  id: string
  filename: string
  content_type: string
  type: 'photo' | 'document'
  hash: string
  uploaded_by: string
  uploaded_at: string
}
