import type { ColumnConfig, Enterprise, NewInteraction } from '../types/enterprise'

// Default columns configuration
export const defaultColumns: ColumnConfig[] = [
  { id: 'category', label: 'Категория', visible: true, sortable: true },
  { id: 'name', label: 'Наименование', visible: true, sortable: true },
  { id: 'inn', label: 'ИНН', visible: true, sortable: true },
  { id: 'holding', label: 'Холдинг', visible: true, sortable: true },
  { id: 'industry', label: 'Отрасль', visible: true, sortable: true },
  { id: 'employee_count', label: 'Численность', visible: true, sortable: true },
  { id: 'manager', label: 'Менеджер', visible: true, sortable: true },
  { id: 'score', label: 'Балл', visible: true, sortable: true },
  { id: 'sales_status', label: 'Этап продаж', visible: true, sortable: true },
  { id: 'status', label: 'Статус', visible: true, sortable: true },
  { id: 'bank_penetration', label: 'Проникн. ЗП', visible: false, sortable: true },
  { id: 'locations', label: 'Площадки', visible: false, sortable: false },
  { id: 'contact_person', label: 'Контакт', visible: false, sortable: true },
  { id: 'contact_phone', label: 'Телефон', visible: false, sortable: false },
  { id: 'contact_email', label: 'Email', visible: false, sortable: false },
]

export const defaultEnterprise: Partial<Enterprise> = {
  name: '',
  industry: '',
  employee_count: 0,
  bank_penetration: 0,
  status: 'prospect',
  category: 'V',
  score: 0,
  sales_status: 'contact',
  inn: '',
  holding: '',
  locations: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  notes: '',
  manager: ''
}

export const defaultInteraction: NewInteraction = {
  interaction_type: 'call',
  description: '',
  result: '',
  created_by: ''
}

export const statusLabels: Record<string, string> = {
  prospect: 'Потенциал',
  negotiation: 'Переговоры',
  pilot: 'Пилот',
  active: 'Активный',
  inactive: 'Неактивный'
}

export const categoryLabels: Record<string, string> = {
  A: 'A — Быстрые победы',
  B: 'B — Рабочие кейсы',
  V: 'В — Длинные проекты',
  G: 'Г — Заморозка'
}

export const salesStatusLabels: Record<string, string> = {
  planned: 'В планах',
  contact: 'Первый контакт',
  negotiation: 'Переговоры',
  contract: 'Договор',
  launched: 'Запущено'
}

export const interactionTypeLabels: Record<string, string> = {
  call: 'Звонок',
  meeting: 'Встреча',
  email: 'Письмо',
  presentation: 'Презентация',
  contract: 'Работа с договором',
  other: 'Прочее'
}

export const interactionTypeIcons: Record<string, string> = {
  call: '📞',
  meeting: '🤝',
  email: '📧',
  presentation: '📊',
  contract: '📝',
  other: '📌'
}

export const salesStages = ['planned', 'contact', 'negotiation', 'contract', 'launched'] as const
