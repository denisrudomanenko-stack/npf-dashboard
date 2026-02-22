export interface Enterprise {
  id: number
  name: string
  industry: string | null
  employee_count: number | null
  bank_penetration: number
  status: EnterpriseStatus
  locations: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_by_id: number | null
  created_at: string
  updated_at: string | null
}

export type EnterpriseStatus = 'prospect' | 'negotiation' | 'pilot' | 'active' | 'inactive'

export interface RoadmapItem {
  id: number
  title: string
  description: string | null
  track: Track
  status: RoadmapStatus
  start_date: string | null
  end_date: string | null
  quarter: string | null
  year: number | null
  dependencies: string | null
  responsible: string | null
  priority: number
  created_by_id: number | null
  created_at: string
  updated_at: string | null
}

export type Track = 'internal_pilot' | 'external_clients'
export type RoadmapStatus = 'planned' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'

export interface Document {
  id: number
  filename: string
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  document_type: DocumentType
  title: string | null
  description: string | null
  status: DocumentStatus
  chunk_count: number
  indexed_at: string | null
  created_by_id: number | null
  created_at: string
  updated_at: string | null
}

export type DocumentType = 'regulation' | 'product' | 'presentation' | 'contract_template' | 'analytics' | 'other'
export type DocumentStatus = 'active' | 'archived' | 'deleted'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StorageStats {
  total_bytes: number
  total_gb: number
  limit_bytes: number
  limit_gb: number
  usage_percent: number
  remaining_bytes: number
  remaining_gb: number
}

export interface AIStatus {
  ai_available: boolean
  can_vectorize: boolean
  can_suggest_name: boolean
  can_ocr: boolean
}
