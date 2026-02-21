import { useEffect, useState, useMemo } from 'react'
import { api } from '../services/api'
import { usePermissions } from '../hooks/usePermissions'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Format number with space separators (Russian locale)
function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value).replace(/\u00A0/g, ' ')
}

// Types
interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  sortable: boolean
}

interface TableSettings {
  columns: ColumnConfig[]
  sortBy: string | null
  sortOrder: 'asc' | 'desc'
}

interface Interaction {
  id: number
  enterprise_id: number
  interaction_type: 'call' | 'meeting' | 'email' | 'presentation' | 'contract' | 'other'
  date: string
  description: string
  result: string | null
  created_by: string | null
  created_at: string
}

interface Enterprise {
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
  created_at: string | null
  updated_at: string | null
  interactions: Interaction[]
}

// Default columns configuration
const defaultColumns: ColumnConfig[] = [
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

const defaultEnterprise: Partial<Enterprise> = {
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

const defaultInteraction: {
  interaction_type: Interaction['interaction_type']
  description: string
  result: string
  created_by: string
} = {
  interaction_type: 'call',
  description: '',
  result: '',
  created_by: ''
}

const statusLabels: Record<string, string> = {
  prospect: 'Потенциал',
  negotiation: 'Переговоры',
  pilot: 'Пилот',
  active: 'Активный',
  inactive: 'Неактивный'
}

const categoryLabels: Record<string, string> = {
  A: 'A — Быстрые победы',
  B: 'B — Рабочие кейсы',
  V: 'В — Длинные проекты',
  G: 'Г — Заморозка'
}

const salesStatusLabels: Record<string, string> = {
  planned: 'В планах',
  contact: 'Первый контакт',
  negotiation: 'Переговоры',
  contract: 'Договор',
  launched: 'Запущено'
}

const interactionTypeLabels: Record<string, string> = {
  call: 'Звонок',
  meeting: 'Встреча',
  email: 'Письмо',
  presentation: 'Презентация',
  contract: 'Работа с договором',
  other: 'Прочее'
}

const interactionTypeIcons: Record<string, string> = {
  call: '📞',
  meeting: '🤝',
  email: '📧',
  presentation: '📊',
  contract: '📝',
  other: '📌'
}

const salesStages = ['planned', 'contact', 'negotiation', 'contract', 'launched']

// Sortable column item component
function SortableColumnItem({ column, onToggle, onRename }: {
  column: ColumnConfig
  onToggle: () => void
  onRename: (label: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="sortable-column-item">
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      <input
        type="checkbox"
        checked={column.visible}
        onChange={onToggle}
      />
      <input
        type="text"
        value={column.label}
        onChange={e => onRename(e.target.value)}
        className="column-label-input"
      />
    </div>
  )
}

function Enterprises() {
  const { canEdit } = usePermissions()
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Partial<Enterprise>>(defaultEnterprise)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterSalesStatus, setFilterSalesStatus] = useState<string>('')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Import mapping state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<{
    columns: string[]
    sample_data: Record<string, unknown>[]
    suggested_mapping: Record<string, string | null>
    available_fields: Record<string, { label: string; required: boolean }>
    total_rows: number
    mapping_method?: 'llm' | 'fallback'
  } | null>(null)
  const [importMapping, setImportMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Interaction state
  const [showAddInteraction, setShowAddInteraction] = useState(false)
  const [newInteraction, setNewInteraction] = useState(defaultInteraction)
  const [savingInteraction, setSavingInteraction] = useState(false)
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null)

  // Table config state
  const [tableSettings, setTableSettings] = useState<TableSettings>({
    columns: defaultColumns,
    sortBy: null,
    sortOrder: 'asc'
  })
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [tempColumns, setTempColumns] = useState<ColumnConfig[]>([])
  const [savingConfig, setSavingConfig] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadEnterprises()
    loadTableConfig()
  }, [])

  const loadEnterprises = async () => {
    try {
      const response = await api.get('/enterprises/')
      setEnterprises(Array.isArray(response.data) ? response.data : [])
      setSelectedIds(new Set()) // Clear selection on reload
    } catch (error) {
      console.error('Failed to load enterprises:', error)
      setEnterprises([])
    } finally {
      setLoading(false)
    }
  }

  const loadTableConfig = async () => {
    try {
      const response = await api.get('/table-config/enterprises')
      if (response.data && response.data.config) {
        setTableSettings(response.data.config)
      }
    } catch (error) {
      console.error('Failed to load table config:', error)
    }
  }

  const saveTableConfig = async (settings: TableSettings) => {
    setSavingConfig(true)
    try {
      await api.put('/table-config/enterprises', { config: settings })
      setTableSettings(settings)
      setShowConfigModal(false)
    } catch (error) {
      console.error('Failed to save table config:', error)
      alert('Ошибка сохранения настроек')
    } finally {
      setSavingConfig(false)
    }
  }

  const resetTableConfig = async () => {
    try {
      await api.delete('/table-config/enterprises')
      setTableSettings({
        columns: defaultColumns,
        sortBy: null,
        sortOrder: 'asc'
      })
      setShowConfigModal(false)
    } catch (error) {
      console.error('Failed to reset config:', error)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await api.post('/enterprises/import/preview', formData)
      setImportPreview(response.data)
      // Convert null values to empty strings for select compatibility
      const suggestedMapping = response.data.suggested_mapping || {}
      const cleanedMapping: Record<string, string> = {}
      for (const [key, value] of Object.entries(suggestedMapping)) {
        cleanedMapping[key] = (value as string | null) || ''
      }
      setImportMapping(cleanedMapping)
      setShowImportModal(true)
      setShowImport(false)
    } catch (error: unknown) {
      console.error('Preview failed:', error)
      const err = error as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail || 'Ошибка чтения файла')
    }
    // Reset input
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!importFile || !importPreview) return

    // Validate that name is mapped
    const nameMapped = Object.values(importMapping).includes('name')
    if (!nameMapped) {
      alert('Необходимо сопоставить поле "Наименование"')
      return
    }

    setImporting(true)
    const formData = new FormData()
    formData.append('file', importFile)
    formData.append('mapping', JSON.stringify(importMapping))

    try {
      const response = await api.post('/enterprises/import', formData)
      alert(response.data.message)
      loadEnterprises()
      closeImportModal()
    } catch (error: unknown) {
      console.error('Import failed:', error)
      const err = error as { response?: { data?: { detail?: string } } }
      alert(err.response?.data?.detail || 'Ошибка импорта')
    } finally {
      setImporting(false)
    }
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportFile(null)
    setImportPreview(null)
    setImportMapping({})
  }

  const updateMapping = (excelCol: string, fieldKey: string) => {
    setImportMapping(prev => ({
      ...prev,
      [excelCol]: fieldKey
    }))
  }

  const openCard = (enterprise: Enterprise) => {
    setSelectedEnterprise(enterprise)
    setEditData(enterprise)
    setEditMode(false)
    setConfirmDelete(false)
    setShowAddInteraction(false)
    setNewInteraction(defaultInteraction)
  }

  const closeCard = () => {
    setSelectedEnterprise(null)
    setEditMode(false)
    setEditData(defaultEnterprise)
    setConfirmDelete(false)
    setShowAddInteraction(false)
  }

  const openCreateModal = () => {
    setShowCreateModal(true)
    setEditData(defaultEnterprise)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setEditData(defaultEnterprise)
  }

  const handleSave = async () => {
    if (!selectedEnterprise) return
    setSaving(true)
    try {
      const response = await api.put(`/enterprises/${selectedEnterprise.id}`, editData)
      await loadEnterprises()
      setSelectedEnterprise(response.data)
      setEditMode(false)
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!editData.name?.trim()) {
      alert('Введите название предприятия')
      return
    }
    setSaving(true)
    try {
      await api.post('/enterprises/', editData)
      await loadEnterprises()
      closeCreateModal()
    } catch (error) {
      console.error('Failed to create:', error)
      alert('Ошибка создания')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedEnterprise) return
    setSaving(true)
    try {
      await api.delete(`/enterprises/${selectedEnterprise.id}`)
      await loadEnterprises()
      closeCard()
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Ошибка удаления')
    } finally {
      setSaving(false)
    }
  }

  const handleAddInteraction = async () => {
    if (!selectedEnterprise || !newInteraction.description.trim()) return
    setSavingInteraction(true)
    try {
      if (editingInteraction) {
        await api.put(`/enterprises/${selectedEnterprise.id}/interactions/${editingInteraction.id}`, newInteraction)
      } else {
        await api.post(`/enterprises/${selectedEnterprise.id}/interactions`, newInteraction)
      }
      const response = await api.get(`/enterprises/${selectedEnterprise.id}`)
      setSelectedEnterprise(response.data)
      await loadEnterprises()
      setNewInteraction(defaultInteraction)
      setShowAddInteraction(false)
      setEditingInteraction(null)
    } catch (error) {
      console.error('Failed to save interaction:', error)
      alert('Ошибка сохранения записи')
    } finally {
      setSavingInteraction(false)
    }
  }

  const handleEditInteraction = (interaction: Interaction) => {
    setEditingInteraction(interaction)
    setNewInteraction({
      interaction_type: interaction.interaction_type,
      description: interaction.description,
      result: interaction.result || '',
      created_by: interaction.created_by || ''
    })
    setShowAddInteraction(true)
  }

  const handleCancelInteractionForm = () => {
    setShowAddInteraction(false)
    setEditingInteraction(null)
    setNewInteraction(defaultInteraction)
  }

  const handleDeleteInteraction = async (interactionId: number) => {
    if (!selectedEnterprise) return
    try {
      await api.delete(`/enterprises/${selectedEnterprise.id}/interactions/${interactionId}`)
      const response = await api.get(`/enterprises/${selectedEnterprise.id}`)
      setSelectedEnterprise(response.data)
      await loadEnterprises()
    } catch (error) {
      console.error('Failed to delete interaction:', error)
    }
  }

  // Multi-select handlers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEnterprises.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredEnterprises.map(e => e.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Удалить ${selectedIds.size} предприятий?`)) return

    setBulkDeleting(true)
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api.delete(`/enterprises/${id}`))
      )
      await loadEnterprises()
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Bulk delete failed:', error)
      alert('Ошибка при удалении')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleSort = (columnId: string) => {
    const column = tableSettings.columns.find(c => c.id === columnId)
    if (!column?.sortable) return

    const newOrder = tableSettings.sortBy === columnId && tableSettings.sortOrder === 'asc' ? 'desc' : 'asc'
    const newSettings = {
      ...tableSettings,
      sortBy: columnId,
      sortOrder: newOrder as 'asc' | 'desc'
    }
    setTableSettings(newSettings)
    // Optionally save to backend immediately
    // saveTableConfig(newSettings)
  }

  const openConfigModal = () => {
    setTempColumns([...tableSettings.columns])
    setShowConfigModal(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setTempColumns((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const toggleColumnVisibility = (columnId: string) => {
    setTempColumns(cols =>
      cols.map(c => c.id === columnId ? { ...c, visible: !c.visible } : c)
    )
  }

  const renameColumn = (columnId: string, newLabel: string) => {
    setTempColumns(cols =>
      cols.map(c => c.id === columnId ? { ...c, label: newLabel } : c)
    )
  }

  const getCategoryBadge = (category: string) => {
    return <span className={`category-badge cat-${category}`}>{category === 'V' ? 'В' : category === 'G' ? 'Г' : category}</span>
  }

  const getStatusBadge = (status: string) => {
    return <span className={`status-badge status-${status}`}>{statusLabels[status] || status}</span>
  }

  const getSalesStatusIndex = (status: string) => salesStages.indexOf(status)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get cell value for a column
  const getCellValue = (enterprise: Enterprise, columnId: string) => {
    switch (columnId) {
      case 'category':
        return getCategoryBadge(enterprise.category)
      case 'name':
        return <strong>{enterprise.name}</strong>
      case 'inn':
        return enterprise.inn || '—'
      case 'holding':
        return enterprise.holding || '—'
      case 'industry':
        return enterprise.industry || '—'
      case 'employee_count':
        return enterprise.employee_count ? formatNumber(enterprise.employee_count) : '—'
      case 'manager':
        return enterprise.manager || '—'
      case 'score':
        return <span className="score-badge">{enterprise.score}</span>
      case 'sales_status':
        return <span className={`sales-badge sales-${enterprise.sales_status}`}>{salesStatusLabels[enterprise.sales_status]}</span>
      case 'status':
        return getStatusBadge(enterprise.status)
      case 'bank_penetration':
        return enterprise.bank_penetration ? `${enterprise.bank_penetration}%` : '—'
      case 'locations':
        return enterprise.locations || '—'
      case 'contact_person':
        return enterprise.contact_person || '—'
      case 'contact_phone':
        return enterprise.contact_phone || '—'
      case 'contact_email':
        return enterprise.contact_email || '—'
      default:
        return '—'
    }
  }

  // Get raw value for sorting
  const getSortValue = (enterprise: Enterprise, columnId: string): string | number => {
    const val = enterprise[columnId as keyof Enterprise]
    if (val === null || val === undefined) return ''
    if (typeof val === 'number') return val
    return String(val).toLowerCase()
  }

  // Visible columns
  const visibleColumns = useMemo(() =>
    tableSettings.columns.filter(c => c.visible),
    [tableSettings.columns]
  )

  // Filter and sort enterprises
  const filteredEnterprises = useMemo(() => {
    let result = enterprises.filter(e => {
      const matchesSearch = !searchQuery ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.inn && e.inn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.holding && e.holding.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.industry && e.industry.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.manager && e.manager.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = !filterCategory || e.category === filterCategory
      const matchesSales = !filterSalesStatus || e.sales_status === filterSalesStatus
      return matchesSearch && matchesCategory && matchesSales
    })

    // Apply sorting
    if (tableSettings.sortBy) {
      result = [...result].sort((a, b) => {
        const aVal = getSortValue(a, tableSettings.sortBy!)
        const bVal = getSortValue(b, tableSettings.sortBy!)
        if (aVal < bVal) return tableSettings.sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return tableSettings.sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [enterprises, searchQuery, filterCategory, filterSalesStatus, tableSettings.sortBy, tableSettings.sortOrder])

  if (loading) return <div className="loading">Загрузка...</div>

  return (
    <div className="enterprises">
      <div className="page-header">
        <h2>Предприятия</h2>
        {canEdit && (
          <div className="actions">
            <button className="btn btn-secondary" onClick={() => setShowImport(!showImport)}>
              Импорт Excel
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + Добавить
            </button>
          </div>
        )}
      </div>

      {canEdit && showImport && (
        <div className="card import-card">
          <h4>Импорт из файла</h4>
          <p>Поддерживаются форматы: .xlsx, .xls, .csv</p>
          <p className="import-hint">После выбора файла откроется окно сопоставления колонок</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
        </div>
      )}

      {/* Filters */}
      <div className="filters-row">
        <input
          type="text"
          placeholder="Поиск по названию, ИНН, холдингу, отрасли или менеджеру..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Все категории</option>
          <option value="A">A — Быстрые победы</option>
          <option value="B">B — Рабочие кейсы</option>
          <option value="V">В — Длинные проекты</option>
          <option value="G">Г — Заморозка</option>
        </select>
        <select value={filterSalesStatus} onChange={e => setFilterSalesStatus(e.target.value)}>
          <option value="">Все этапы продаж</option>
          {salesStages.map(s => (
            <option key={s} value={s}>{salesStatusLabels[s]}</option>
          ))}
        </select>
        <span className="results-count">{filteredEnterprises.length} из {enterprises.length}</span>
      </div>

      {/* Bulk Actions Toolbar */}
      {canEdit && selectedIds.size > 0 && (
        <div className="bulk-toolbar">
          <span className="bulk-count">Выбрано: {selectedIds.size}</span>
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? 'Удаление...' : '🗑️ Удалить выбранные'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={clearSelection}>
            Снять выделение
          </button>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              {canEdit && (
                <th className="checkbox-th">
                  <input
                    type="checkbox"
                    checked={filteredEnterprises.length > 0 && selectedIds.size === filteredEnterprises.length}
                    onChange={toggleSelectAll}
                    title="Выбрать все"
                  />
                </th>
              )}
              {visibleColumns.map(col => (
                <th
                  key={col.id}
                  onClick={() => handleSort(col.id)}
                  className={col.sortable ? 'sortable' : ''}
                >
                  {col.label}
                  {tableSettings.sortBy === col.id && (
                    <span className="sort-indicator">
                      {tableSettings.sortOrder === 'asc' ? ' ▲' : ' ▼'}
                    </span>
                  )}
                </th>
              ))}
              <th className="settings-th">
                <button className="btn-settings" onClick={openConfigModal} title="Настроить столбцы">
                  ⚙️
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEnterprises.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (canEdit ? 2 : 1)} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {enterprises.length === 0
                    ? (canEdit ? 'Нет данных. Импортируйте файл или добавьте предприятие.' : 'Нет данных.')
                    : 'Нет результатов по заданным фильтрам.'}
                </td>
              </tr>
            ) : (
              filteredEnterprises.map((e) => (
                <tr key={e.id} onClick={() => openCard(e)} className={`clickable-row ${selectedIds.has(e.id) ? 'selected-row' : ''}`}>
                  {canEdit && (
                    <td className="checkbox-cell" onClick={(ev) => ev.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(e.id)}
                        onChange={() => toggleSelect(e.id)}
                      />
                    </td>
                  )}
                  {visibleColumns.map(col => (
                    <td key={col.id}>{getCellValue(e, col.id)}</td>
                  ))}
                  <td className="actions-cell">
                    <button
                      className="btn-row-delete"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        if (confirm(`Удалить "${e.name}"?`)) {
                          api.delete(`/enterprises/${e.id}`).then(() => loadEnterprises())
                        }
                      }}
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Column Config Modal */}
      {showConfigModal && (
        <div className="modal-backdrop" onClick={() => setShowConfigModal(false)}>
          <div className="config-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Настройка столбцов</h3>
              <button className="btn-close" onClick={() => setShowConfigModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="config-hint">Перетаскивайте для изменения порядка. Снимите галочку, чтобы скрыть столбец.</p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={tempColumns.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="columns-list">
                    {tempColumns.map(col => (
                      <SortableColumnItem
                        key={col.id}
                        column={col}
                        onToggle={() => toggleColumnVisibility(col.id)}
                        onRename={(label) => renameColumn(col.id, label)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={resetTableConfig}>
                Сбросить
              </button>
              <button
                className="btn btn-primary"
                onClick={() => saveTableConfig({ ...tableSettings, columns: tempColumns })}
                disabled={savingConfig}
              >
                {savingConfig ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Card Modal */}
      {selectedEnterprise && (
        <div className="modal-backdrop" onClick={closeCard}>
          <div className="client-card" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <div className="card-title-row">
                {editMode ? (
                  <input
                    type="text"
                    className="name-input"
                    value={editData.name || ''}
                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                    placeholder="Название предприятия"
                  />
                ) : (
                  <h2>{selectedEnterprise.name}</h2>
                )}
                <div className="card-actions">
                  {canEdit && !editMode && (
                    <button className="btn-icon" onClick={() => setEditMode(true)} title="Редактировать">
                      ✏️
                    </button>
                  )}
                  <button className="btn-close" onClick={closeCard}>✕</button>
                </div>
              </div>
              <div className="card-meta">
                {getCategoryBadge(selectedEnterprise.category)}
                <span className="score-display">{selectedEnterprise.score} баллов</span>
                {selectedEnterprise.manager && (
                  <span className="manager-badge">👤 {selectedEnterprise.manager}</span>
                )}
              </div>
            </div>

            <div className="card-body">
              {/* Sales Funnel */}
              <div className="section">
                <h3>Воронка продаж</h3>
                <div className="sales-funnel">
                  {salesStages.map((stage, idx) => {
                    const currentIdx = getSalesStatusIndex(editMode ? (editData.sales_status || 'contact') : selectedEnterprise.sales_status)
                    const isPast = idx < currentIdx
                    const isCurrent = idx === currentIdx
                    return (
                      <div
                        key={stage}
                        className={`funnel-stage ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''} ${editMode ? 'editable' : ''}`}
                        onClick={() => editMode && setEditData({ ...editData, sales_status: stage as Enterprise['sales_status'] })}
                        title={salesStatusLabels[stage]}
                      >
                        <span className="stage-dot">{isPast ? '✓' : isCurrent ? '●' : '○'}</span>
                        <span className="stage-label">{salesStatusLabels[stage]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Main Info */}
              <div className="section">
                <h3>Основная информация</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>ИНН</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.inn || ''}
                        onChange={e => setEditData({ ...editData, inn: e.target.value })}
                        placeholder="10 или 12 цифр"
                        maxLength={12}
                      />
                    ) : (
                      <span>{selectedEnterprise.inn || '—'}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Холдинг</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.holding || ''}
                        onChange={e => setEditData({ ...editData, holding: e.target.value })}
                        placeholder="Группа компаний"
                      />
                    ) : (
                      <span>{selectedEnterprise.holding || '—'}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Отрасль</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.industry || ''}
                        onChange={e => setEditData({ ...editData, industry: e.target.value })}
                      />
                    ) : (
                      <span>{selectedEnterprise.industry || '—'}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Сотрудников</label>
                    {editMode ? (
                      <input
                        type="number"
                        value={editData.employee_count || ''}
                        onChange={e => setEditData({ ...editData, employee_count: parseInt(e.target.value) || 0 })}
                      />
                    ) : (
                      <span>{selectedEnterprise.employee_count ? formatNumber(selectedEnterprise.employee_count) : '—'}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Проникновение ЗП</label>
                    {editMode ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editData.bank_penetration || ''}
                        onChange={e => setEditData({ ...editData, bank_penetration: parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <span>{selectedEnterprise.bank_penetration ? `${selectedEnterprise.bank_penetration}%` : '—'}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Категория</label>
                    {editMode ? (
                      <select
                        value={editData.category || 'V'}
                        onChange={e => setEditData({ ...editData, category: e.target.value as Enterprise['category'] })}
                      >
                        {Object.entries(categoryLabels).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{categoryLabels[selectedEnterprise.category]}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Скоринг-балл</label>
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editData.score || 0}
                        onChange={e => setEditData({ ...editData, score: parseInt(e.target.value) || 0 })}
                      />
                    ) : (
                      <span>{selectedEnterprise.score}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Ответственный менеджер</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.manager || ''}
                        onChange={e => setEditData({ ...editData, manager: e.target.value })}
                        placeholder="ФИО менеджера"
                      />
                    ) : (
                      <span>{selectedEnterprise.manager || '—'}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Статус</label>
                    {editMode ? (
                      <select
                        value={editData.status || 'prospect'}
                        onChange={e => setEditData({ ...editData, status: e.target.value as Enterprise['status'] })}
                      >
                        {Object.entries(statusLabels).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{statusLabels[selectedEnterprise.status]}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Площадки</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.locations || ''}
                        onChange={e => setEditData({ ...editData, locations: e.target.value })}
                        placeholder="Москва, Санкт-Петербург, ..."
                      />
                    ) : (
                      <span>{selectedEnterprise.locations || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div className="section">
                <h3>Контакты</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Контактное лицо</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.contact_person || ''}
                        onChange={e => setEditData({ ...editData, contact_person: e.target.value })}
                        placeholder="ФИО"
                      />
                    ) : (
                      <span>{selectedEnterprise.contact_person || '—'}</span>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Телефон</label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={editData.contact_phone || ''}
                        onChange={e => setEditData({ ...editData, contact_phone: e.target.value })}
                        placeholder="+7 ..."
                      />
                    ) : (
                      <span>{selectedEnterprise.contact_phone || '—'}</span>
                    )}
                  </div>
                  <div className="info-item full-width">
                    <label>Email</label>
                    {editMode ? (
                      <input
                        type="email"
                        value={editData.contact_email || ''}
                        onChange={e => setEditData({ ...editData, contact_email: e.target.value })}
                        placeholder="email@company.ru"
                      />
                    ) : (
                      <span>{selectedEnterprise.contact_email || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Interaction History */}
              <div className="section">
                <div className="section-header">
                  <h3>История контактов</h3>
                  {canEdit && !editMode && !showAddInteraction && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => { setShowAddInteraction(true); setEditingInteraction(null); setNewInteraction(defaultInteraction); }}
                    >
                      + Добавить
                    </button>
                  )}
                </div>

                {showAddInteraction && (
                  <div className="add-interaction-form">
                    <div className="form-title">
                      {editingInteraction ? '✏️ Редактирование записи' : '➕ Новая запись'}
                    </div>
                    <div className="form-row">
                      <select
                        value={newInteraction.interaction_type}
                        onChange={e => setNewInteraction({ ...newInteraction, interaction_type: e.target.value as Interaction['interaction_type'] })}
                      >
                        {Object.entries(interactionTypeLabels).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Автор записи"
                        value={newInteraction.created_by}
                        onChange={e => setNewInteraction({ ...newInteraction, created_by: e.target.value })}
                      />
                    </div>
                    <textarea
                      placeholder="Описание контакта..."
                      value={newInteraction.description}
                      onChange={e => setNewInteraction({ ...newInteraction, description: e.target.value })}
                      rows={2}
                    />
                    <input
                      type="text"
                      placeholder="Результат/итог (опционально)"
                      value={newInteraction.result}
                      onChange={e => setNewInteraction({ ...newInteraction, result: e.target.value })}
                    />
                    <div className="form-actions">
                      <button className="btn btn-secondary btn-sm" onClick={handleCancelInteractionForm}>
                        Отмена
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleAddInteraction}
                        disabled={savingInteraction || !newInteraction.description.trim()}
                      >
                        {savingInteraction ? 'Сохранение...' : (editingInteraction ? 'Сохранить' : 'Добавить')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="interactions-list">
                  {(!selectedEnterprise.interactions || selectedEnterprise.interactions.length === 0) ? (
                    <p className="no-interactions">Нет записей о контактах</p>
                  ) : (
                    selectedEnterprise.interactions.map(interaction => (
                      <div key={interaction.id} className="interaction-item">
                        <div className="interaction-icon">
                          {interactionTypeIcons[interaction.interaction_type] || '📌'}
                        </div>
                        <div className="interaction-content">
                          <div className="interaction-header">
                            <span className="interaction-type">{interactionTypeLabels[interaction.interaction_type]}</span>
                            <span className="interaction-date">{formatDate(interaction.date)}</span>
                            {canEdit && !editMode && (
                              <div className="interaction-actions">
                                <button
                                  className="btn-edit-interaction"
                                  onClick={() => handleEditInteraction(interaction)}
                                  title="Редактировать"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn-delete-interaction"
                                  onClick={() => handleDeleteInteraction(interaction.id)}
                                  title="Удалить"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="interaction-description">{interaction.description}</p>
                          {interaction.result && (
                            <p className="interaction-result">
                              <strong>Итог:</strong> {interaction.result}
                            </p>
                          )}
                          {interaction.created_by && (
                            <span className="interaction-author">— {interaction.created_by}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="section">
                <h3>Заметки</h3>
                {editMode ? (
                  <textarea
                    value={editData.notes || ''}
                    onChange={e => setEditData({ ...editData, notes: e.target.value })}
                    placeholder="Заметки о клиенте..."
                    rows={3}
                  />
                ) : (
                  <p className="notes-text">{selectedEnterprise.notes || 'Нет заметок'}</p>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="card-footer">
                {confirmDelete ? (
                  <div className="delete-confirm">
                    <span>Удалить предприятие?</span>
                    <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                      {saving ? '...' : 'Да, удалить'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                      Отмена
                    </button>
                  </div>
                ) : (
                  <>
                    <button className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
                      Удалить
                    </button>
                    <div className="footer-right">
                      {editMode ? (
                        <>
                          <button className="btn btn-secondary" onClick={() => { setEditMode(false); setEditData(selectedEnterprise); }}>
                            Отмена
                          </button>
                          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Сохранение...' : 'Сохранить'}
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                          Редактировать
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={closeCreateModal}>
          <div className="client-card create-card" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h2>Новое предприятие</h2>
              <button className="btn-close" onClick={closeCreateModal}>✕</button>
            </div>
            <div className="card-body">
              <div className="section">
                <div className="info-grid">
                  <div className="info-item full-width">
                    <label>Название *</label>
                    <input
                      type="text"
                      value={editData.name || ''}
                      onChange={e => setEditData({ ...editData, name: e.target.value })}
                      placeholder="ПАО «Название»"
                      autoFocus
                    />
                  </div>
                  <div className="info-item">
                    <label>ИНН</label>
                    <input
                      type="text"
                      value={editData.inn || ''}
                      onChange={e => setEditData({ ...editData, inn: e.target.value })}
                      placeholder="10 или 12 цифр"
                      maxLength={12}
                    />
                  </div>
                  <div className="info-item">
                    <label>Холдинг</label>
                    <input
                      type="text"
                      value={editData.holding || ''}
                      onChange={e => setEditData({ ...editData, holding: e.target.value })}
                      placeholder="Группа компаний"
                    />
                  </div>
                  <div className="info-item">
                    <label>Отрасль</label>
                    <input
                      type="text"
                      value={editData.industry || ''}
                      onChange={e => setEditData({ ...editData, industry: e.target.value })}
                    />
                  </div>
                  <div className="info-item">
                    <label>Сотрудников</label>
                    <input
                      type="number"
                      value={editData.employee_count || ''}
                      onChange={e => setEditData({ ...editData, employee_count: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="info-item">
                    <label>Категория</label>
                    <select
                      value={editData.category || 'V'}
                      onChange={e => setEditData({ ...editData, category: e.target.value as Enterprise['category'] })}
                    >
                      {Object.entries(categoryLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="info-item">
                    <label>Ответственный менеджер</label>
                    <input
                      type="text"
                      value={editData.manager || ''}
                      onChange={e => setEditData({ ...editData, manager: e.target.value })}
                      placeholder="ФИО менеджера"
                    />
                  </div>
                  <div className="info-item">
                    <label>Контактное лицо</label>
                    <input
                      type="text"
                      value={editData.contact_person || ''}
                      onChange={e => setEditData({ ...editData, contact_person: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-footer">
              <button className="btn btn-secondary" onClick={closeCreateModal}>Отмена</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !editData.name?.trim()}>
                {saving ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Mapping Modal */}
      {showImportModal && importPreview && (
        <div className="modal-backdrop" onClick={closeImportModal}>
          <div className="import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Сопоставление колонок</h3>
                <span className="import-file-info">
                  {importFile?.name} — {importPreview.total_rows} строк данных (без заголовка)
                </span>
              </div>
              <button className="btn-close" onClick={closeImportModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mapping-hint">
                <div className="hint-header">
                  <span className="hint-icon">{importPreview.mapping_method === 'llm' ? '🤖' : '📋'}</span>
                  <strong>
                    {importPreview.mapping_method === 'llm'
                      ? 'AI проанализировал структуру файла'
                      : 'Автоматическое сопоставление'}
                  </strong>
                  {importPreview.mapping_method === 'llm' && (
                    <span className="llm-badge">LLM</span>
                  )}
                </div>
                <p>
                  {importPreview.mapping_method === 'llm'
                    ? 'Локальная LLM-модель проанализировала заголовки и примеры данных для интеллектуального сопоставления полей.'
                    : 'Система сопоставила колонки на основе названий заголовков.'}
                  {' '}Проверьте соответствие и измените при необходимости.
                </p>
                <p>Поле "Наименование" <span className="required-star">*</span> обязательно для импорта.</p>
              </div>

              <div className="mapping-table-wrapper">
                <table className="mapping-table">
                  <thead>
                    <tr>
                      <th>Заголовок в файле (1-я строка)</th>
                      <th>Примеры данных (строки 2-3)</th>
                      <th>Поле в системе</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.columns.map(col => {
                      const suggestedField = importPreview.suggested_mapping[col]
                      const currentField = importMapping[col]
                      const isAutoSuggested = suggestedField && currentField === suggestedField
                      const isMapped = !!currentField

                      return (
                        <tr key={col} className={isMapped ? 'row-mapped' : ''}>
                          <td className="col-name">
                            {col}
                            {isAutoSuggested && <span className="auto-badge">авто</span>}
                          </td>
                          <td className="col-sample">
                            {importPreview.sample_data.slice(0, 2).map((row, i) => (
                              <div key={i} className="sample-value">
                                {String(row[col] || '—').substring(0, 40)}
                              </div>
                            ))}
                          </td>
                          <td className="col-mapping">
                            <select
                              value={currentField || ''}
                              onChange={e => updateMapping(col, e.target.value)}
                              className={`${currentField === 'name' ? 'required-mapped' : ''} ${isMapped ? 'is-mapped' : ''}`}
                            >
                              <option value="">— Не импортировать —</option>
                              {Object.entries(importPreview.available_fields).map(([key, field]) => (
                                <option key={key} value={key}>
                                  {field.label} {field.required ? '*' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="col-status">
                            {currentField === 'name' && <span className="status-icon status-required">✓</span>}
                            {currentField && currentField !== 'name' && <span className="status-icon status-ok">✓</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mapping-summary">
                <div className="summary-left">
                  <span className={Object.values(importMapping).includes('name') ? 'valid' : 'invalid'}>
                    {Object.values(importMapping).includes('name') ? '✓' : '✗'} Наименование
                  </span>
                </div>
                <div className="summary-right">
                  <span className="auto-count">
                    Автоопределено: {Object.entries(importPreview.suggested_mapping).filter(([k, v]) => v && importMapping[k] === v).length}
                  </span>
                  <span className="mapped-count">
                    Всего сопоставлено: {Object.values(importMapping).filter(v => v).length} из {importPreview.columns.length}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeImportModal}>Отмена</button>
              <button
                className="btn btn-primary"
                onClick={handleImportConfirm}
                disabled={importing || !Object.values(importMapping).includes('name')}
              >
                {importing ? 'Импорт...' : `Импортировать ${importPreview.total_rows} строк`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .enterprises {
          padding: 0;
        }
        .loading {
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .page-header h2 {
          margin: 0;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }
        .btn-sm {
          padding: 5px 10px;
          font-size: 12px;
        }
        .btn-primary {
          background: var(--primary);
          color: white;
        }
        .btn-primary:hover {
          opacity: 0.9;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: #f0f0f0;
          color: var(--text);
          border: 1px solid var(--border);
        }
        .btn-secondary:hover {
          background: #e5e5e5;
        }
        .btn-danger {
          background: #dc2626;
          color: white;
        }
        .btn-danger:hover {
          background: #b91c1c;
        }
        .btn-danger-outline {
          background: white;
          color: #dc2626;
          border: 1px solid #dc2626;
        }
        .btn-danger-outline:hover {
          background: #fef2f2;
        }

        /* Import Card */
        .import-card {
          margin-bottom: 1rem;
          padding: 16px;
        }
        .import-card h4 {
          margin: 0 0 8px;
        }
        .import-card p {
          color: var(--text-muted);
          font-size: 12px;
          margin: 0 0 8px;
        }
        .import-hint {
          color: #6366f1;
          font-style: italic;
        }

        /* Import Modal */
        .import-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .import-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }
        .import-modal .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .import-file-info {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
          display: block;
        }
        .import-modal .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .mapping-hint {
          font-size: 13px;
          color: var(--text-muted);
          margin: 0 0 16px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .mapping-table-wrapper {
          overflow-x: auto;
          margin-bottom: 16px;
        }
        .mapping-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .mapping-table th {
          text-align: left;
          padding: 10px 12px;
          background: #f8f9fa;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .mapping-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
        }
        .col-name {
          font-weight: 500;
          max-width: 200px;
          word-break: break-word;
        }
        .col-sample {
          max-width: 200px;
          color: var(--text-muted);
          font-size: 12px;
        }
        .sample-value {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 2px 0;
        }
        .col-mapping select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 13px;
          background: white;
        }
        .col-mapping select:focus {
          outline: none;
          border-color: var(--primary);
        }
        .col-mapping select.required-mapped {
          border-color: #22c55e;
          background: #f0fdf4;
        }
        .hint-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: var(--text);
        }
        .hint-icon {
          font-size: 18px;
        }
        .llm-badge {
          display: inline-block;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .mapping-hint p {
          margin: 0 0 8px;
          color: var(--text-muted);
        }
        .mapping-hint p:last-child {
          margin: 0;
        }
        .required-star {
          color: #dc2626;
          font-weight: bold;
        }
        .row-mapped {
          background: #f0fdf4;
        }
        .auto-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 500;
          color: #6366f1;
          background: #eef2ff;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .col-status {
          width: 30px;
          text-align: center;
        }
        .status-icon {
          font-size: 14px;
        }
        .status-required {
          color: #22c55e;
          font-weight: bold;
        }
        .status-ok {
          color: #6366f1;
        }
        .col-mapping select.is-mapped {
          border-color: #22c55e;
          background: #f0fdf4;
        }
        .mapping-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 6px;
          font-size: 13px;
        }
        .summary-left {
          display: flex;
          gap: 16px;
        }
        .summary-right {
          display: flex;
          gap: 16px;
        }
        .mapping-summary .valid {
          color: #22c55e;
          font-weight: 600;
        }
        .mapping-summary .invalid {
          color: #dc2626;
          font-weight: 600;
        }
        .auto-count {
          color: #6366f1;
        }
        .mapped-count {
          color: var(--text-muted);
        }
        .import-modal .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--border);
        }

        /* Filters */
        .filters-row {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: center;
          flex-wrap: wrap;
        }
        .search-input {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 13px;
        }
        .filters-row select {
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 13px;
          background: white;
        }
        .results-count {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* Bulk Toolbar */
        .bulk-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .bulk-count {
          font-size: 13px;
          font-weight: 600;
          color: #4338ca;
        }

        /* Table */
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        th {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 600;
          white-space: nowrap;
        }
        th.sortable {
          cursor: pointer;
          user-select: none;
        }
        th.sortable:hover {
          color: var(--primary);
        }
        .sort-indicator {
          color: var(--primary);
          font-size: 10px;
        }
        .settings-th {
          width: 40px;
          text-align: center;
        }
        .checkbox-th,
        .checkbox-cell {
          width: 40px;
          text-align: center;
        }
        .checkbox-th input,
        .checkbox-cell input {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--primary);
        }
        .selected-row {
          background: #eef2ff !important;
        }
        .btn-settings {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          opacity: 0.6;
          padding: 4px;
        }
        .btn-settings:hover {
          opacity: 1;
        }
        .clickable-row {
          cursor: pointer;
          transition: background 0.15s;
        }
        .clickable-row:hover {
          background: #f8f9fa;
        }
        .actions-cell {
          width: 40px;
          text-align: center;
        }
        .btn-row-delete {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          opacity: 0;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.15s;
        }
        .clickable-row:hover .btn-row-delete {
          opacity: 0.5;
        }
        .btn-row-delete:hover {
          opacity: 1 !important;
          background: #fee2e2;
        }

        /* Badges */
        .category-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 700;
          color: white;
        }
        .cat-A { background: #22c55e; }
        .cat-B { background: #3b82f6; }
        .cat-V { background: #f59e0b; }
        .cat-G { background: #6b7280; }

        .status-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
        .status-prospect { background: #e0e7ff; color: #4338ca; }
        .status-pilot { background: #dbeafe; color: #2563eb; }
        .status-active { background: #d1fae5; color: #059669; }
        .status-inactive { background: #f3f4f6; color: #6b7280; }

        .sales-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          background: #f3f4f6;
          color: var(--text);
        }
        .sales-planned {
          background: #f3f4f6;
          color: #6b7280;
        }
        .sales-contact {
          background: #fef3c7;
          color: #d97706;
        }
        .sales-negotiation {
          background: #fce7f3;
          color: #db2777;
        }
        .sales-contract {
          background: #dbeafe;
          color: #2563eb;
        }
        .sales-launched {
          background: #d1fae5;
          color: #059669;
        }

        .score-badge {
          display: inline-block;
          padding: 2px 6px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .manager-badge {
          font-size: 13px;
          color: var(--text);
          background: #e0e7ff;
          padding: 2px 8px;
          border-radius: 4px;
        }

        /* Config Modal */
        .config-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 400px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .config-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .config-modal .modal-header h3 {
          margin: 0;
          font-size: 16px;
        }
        .config-modal .modal-body {
          padding: 16px 20px;
          overflow-y: auto;
          flex: 1;
        }
        .config-hint {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0 0 16px;
        }
        .columns-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sortable-column-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid var(--border);
        }
        .drag-handle {
          cursor: grab;
          color: var(--text-muted);
          font-size: 16px;
          user-select: none;
        }
        .drag-handle:active {
          cursor: grabbing;
        }
        .column-label-input {
          flex: 1;
          border: 1px solid transparent;
          background: transparent;
          padding: 4px 8px;
          font-size: 13px;
          border-radius: 4px;
        }
        .column-label-input:focus {
          outline: none;
          border-color: var(--primary);
          background: white;
        }
        .config-modal .modal-footer {
          display: flex;
          justify-content: space-between;
          padding: 16px 20px;
          border-top: 1px solid var(--border);
        }

        /* Main Modal */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        /* Client Card */
        .client-card {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 700px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .create-card {
          max-width: 500px;
        }
        .card-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }
        .card-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .card-header h2 {
          margin: 0;
          font-size: 20px;
        }
        .name-input {
          flex: 1;
          font-size: 20px;
          font-weight: 600;
          padding: 4px 8px;
          border: 1px solid var(--primary);
          border-radius: 4px;
        }
        .card-actions {
          display: flex;
          gap: 8px;
        }
        .btn-icon {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          opacity: 0.6;
        }
        .btn-icon:hover {
          opacity: 1;
        }
        .btn-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-muted);
          line-height: 1;
        }
        .btn-close:hover {
          color: var(--text);
        }
        .card-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .score-display {
          font-size: 13px;
          color: var(--text-muted);
          background: #f0f0f0;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .card-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .section {
          margin-bottom: 24px;
        }
        .section:last-child {
          margin-bottom: 0;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .section-header h3 {
          margin: 0;
        }
        .section h3 {
          font-size: 13px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin: 0 0 12px;
          font-weight: 600;
        }

        /* Sales Funnel */
        .sales-funnel {
          display: flex;
          gap: 4px;
        }
        .funnel-stage {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 8px;
          background: #f8f9fa;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .funnel-stage.editable {
          cursor: pointer;
        }
        .funnel-stage.editable:hover {
          background: #e8e8e8;
        }
        .funnel-stage.past {
          background: #d1fae5;
        }
        .funnel-stage.current {
          background: #dbeafe;
          border: 2px solid #3b82f6;
        }
        .stage-dot {
          font-size: 16px;
          margin-bottom: 4px;
        }
        .funnel-stage.past .stage-dot {
          color: #059669;
        }
        .funnel-stage.current .stage-dot {
          color: #3b82f6;
        }
        .stage-label {
          font-size: 10px;
          text-align: center;
          color: var(--text-muted);
        }
        .funnel-stage.current .stage-label {
          color: #2563eb;
          font-weight: 600;
        }

        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .info-item.full-width {
          grid-column: 1 / -1;
        }
        .info-item label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .info-item span {
          font-size: 14px;
        }
        .info-item input,
        .info-item select {
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 14px;
        }
        .info-item input:focus,
        .info-item select:focus {
          outline: none;
          border-color: var(--primary);
        }

        textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
        }
        textarea:focus {
          outline: none;
          border-color: var(--primary);
        }
        .notes-text {
          font-size: 14px;
          color: var(--text-muted);
          margin: 0;
          white-space: pre-wrap;
        }

        /* Interactions */
        .add-interaction-form {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .add-interaction-form .form-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 4px;
        }
        .add-interaction-form .form-row {
          display: flex;
          gap: 8px;
        }
        .add-interaction-form select,
        .add-interaction-form input {
          flex: 1;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 13px;
        }
        .add-interaction-form textarea {
          font-size: 13px;
        }
        .add-interaction-form .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .interactions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .no-interactions {
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
          padding: 20px;
          margin: 0;
        }
        .interaction-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 3px solid var(--primary);
        }
        .interaction-icon {
          font-size: 20px;
          flex-shrink: 0;
        }
        .interaction-content {
          flex: 1;
          min-width: 0;
        }
        .interaction-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .interaction-type {
          font-size: 12px;
          font-weight: 600;
          color: var(--primary);
        }
        .interaction-date {
          font-size: 11px;
          color: var(--text-muted);
        }
        .interaction-actions {
          margin-left: auto;
          display: flex;
          gap: 4px;
        }
        .btn-edit-interaction,
        .btn-delete-interaction {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .btn-edit-interaction:hover {
          background: #dbeafe;
          color: #2563eb;
        }
        .btn-delete-interaction:hover {
          background: #fee2e2;
          color: #dc2626;
        }
        .interaction-description {
          font-size: 13px;
          margin: 0 0 4px;
          color: var(--text);
        }
        .interaction-result {
          font-size: 12px;
          margin: 0 0 4px;
          color: #059669;
        }
        .interaction-author {
          font-size: 11px;
          color: var(--text-muted);
          font-style: italic;
        }

        .card-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .footer-right {
          display: flex;
          gap: 8px;
        }
        .delete-confirm {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }
        .delete-confirm span {
          color: #dc2626;
          font-weight: 500;
        }

        /* Responsive - Tablet */
        @media (max-width: 1024px) {
          .enterprises {
            padding: 16px;
          }
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .actions {
            justify-content: flex-start;
          }
          .filters-row {
            flex-direction: column;
            align-items: stretch;
          }
          .search-input {
            min-width: 100%;
          }
          .filters-row select {
            width: 100%;
          }
          .results-count {
            text-align: center;
          }
          /* Table horizontal scroll */
          .card {
            overflow-x: auto;
          }
          table {
            min-width: 800px;
          }
          /* Client Card */
          .client-card {
            width: 95vw;
            max-width: 600px;
          }
          .info-grid {
            grid-template-columns: 1fr;
          }
          .sales-funnel {
            flex-wrap: wrap;
          }
          .funnel-stage {
            min-width: calc(50% - 4px);
          }
        }

        /* Responsive - Mobile */
        @media (max-width: 640px) {
          .enterprises {
            padding: 12px;
          }
          .page-header h2 {
            font-size: 20px;
          }
          .actions {
            flex-direction: column;
            width: 100%;
          }
          .actions .btn {
            width: 100%;
            justify-content: center;
          }
          .import-card {
            padding: 12px;
          }
          .bulk-toolbar {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }
          .bulk-count {
            text-align: center;
          }
          .bulk-toolbar .btn {
            width: 100%;
            justify-content: center;
          }
          /* Table adjustments */
          th, td {
            padding: 8px;
            font-size: 12px;
          }
          .checkbox-th,
          .checkbox-cell {
            width: 32px;
          }
          /* Client Card mobile */
          .client-card {
            width: 100vw;
            max-width: 100vw;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
            margin: 0;
          }
          .card-header {
            padding: 14px;
          }
          .card-header h2 {
            font-size: 16px;
          }
          .card-body {
            padding: 14px;
          }
          .card-footer {
            padding: 14px;
            flex-direction: column;
            gap: 10px;
          }
          .card-footer .btn {
            width: 100%;
            justify-content: center;
          }
          .footer-right {
            width: 100%;
            display: flex;
            gap: 8px;
          }
          .footer-right .btn {
            flex: 1;
          }
          .section h3 {
            font-size: 13px;
          }
          .info-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          .info-item .info-label {
            min-width: auto;
          }
          .sales-funnel {
            gap: 4px;
          }
          .funnel-stage {
            min-width: 100%;
            padding: 8px;
          }
          .funnel-label {
            font-size: 10px;
          }
          .funnel-count {
            font-size: 14px;
          }
          /* Interactions mobile */
          .add-interaction-form {
            padding: 12px;
          }
          .add-interaction-form .form-row {
            flex-direction: column;
          }
          .interaction-item {
            padding: 10px;
          }
          .interaction-actions {
            position: static;
            margin-top: 8px;
          }
          /* Import Modal mobile */
          .import-modal {
            width: 100vw;
            max-width: 100vw;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
          }
          .import-modal .modal-header,
          .import-modal .modal-body,
          .import-modal .modal-footer {
            padding: 12px;
          }
          .mapping-row {
            flex-direction: column;
            gap: 8px;
          }
          .col-source, .col-target {
            width: 100%;
          }
          /* Column Config Modal mobile */
          .config-modal {
            width: 100vw;
            max-width: 100vw;
            height: auto;
            max-height: 90vh;
            border-radius: 12px 12px 0 0;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
          }
          /* Create Modal mobile */
          .create-card {
            width: 100vw;
            max-width: 100vw;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
          }
        }

        /* Very small screens */
        @media (max-width: 380px) {
          .card-meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  )
}

export default Enterprises
