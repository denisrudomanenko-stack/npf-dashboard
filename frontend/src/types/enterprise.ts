// Enterprise types and interfaces

export interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  sortable: boolean
}

export interface TableSettings {
  columns: ColumnConfig[]
  sortBy: string | null
  sortOrder: 'asc' | 'desc'
}

export interface Interaction {
  id: number
  enterprise_id: number
  interaction_type: 'call' | 'meeting' | 'email' | 'presentation' | 'contract' | 'other'
  date: string
  description: string
  result: string | null
  created_by: string | null
  created_at: string
}

export interface Enterprise {
  id: number
  name: string
  industry: string | null
  employee_count: number | null
  bank_penetration: number | null
  status: 'prospect' | 'negotiation' | 'pilot' | 'active' | 'inactive'
  category: 'A' | 'B' | 'V' | 'G'
  score: number
  sales_status: 'planned' | 'contact' | 'negotiation' | 'contract' | 'launched'
  inn: string | null
  holding: string | null
  locations: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  manager: string | null
  created_by_id: number | null
  created_at: string | null
  updated_at: string | null
  interactions: Interaction[]
}

export interface ImportPreview {
  columns: string[]
  sample_data: Record<string, unknown>[]
  suggested_mapping: Record<string, string | null>
  available_fields: Record<string, { label: string; required: boolean }>
  total_rows: number
  mapping_method?: 'llm' | 'fallback'
}

export interface NewInteraction {
  interaction_type: Interaction['interaction_type']
  description: string
  result: string
  created_by: string
}
