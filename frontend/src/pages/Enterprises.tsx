import { useEffect, useState, useMemo } from 'react'
import { api } from '../services/api'
import { usePermissions } from '../hooks/usePermissions'

// Types
import type { Enterprise, Interaction, TableSettings, ImportPreview, NewInteraction } from '../types/enterprise'

// Constants
import {
  defaultColumns,
  defaultEnterprise,
  defaultInteraction,
  statusLabels,
  salesStatusLabels
} from '../constants/enterprise'

// Utils
import { formatNumber } from '../utils/formatters'

// Components
import {
  EnterpriseFilters,
  BulkActionsToolbar,
  ColumnConfigModal,
  ImportMappingModal,
  CreateEnterpriseModal,
  EnterpriseCard
} from '../components/enterprises'

// Styles
import '../components/enterprises/Enterprises.css'

function Enterprises() {
  const { canEdit, canEditEntity } = usePermissions()

  // Data state
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [showImport, setShowImport] = useState(false)
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Partial<Enterprise>>(defaultEnterprise)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterSalesStatus, setFilterSalesStatus] = useState<string>('')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importMapping, setImportMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Interaction state
  const [showAddInteraction, setShowAddInteraction] = useState(false)
  const [newInteraction, setNewInteraction] = useState<NewInteraction>(defaultInteraction)
  const [savingInteraction, setSavingInteraction] = useState(false)
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null)

  // Table config state
  const [tableSettings, setTableSettings] = useState<TableSettings>({
    columns: defaultColumns,
    sortBy: null,
    sortOrder: 'asc'
  })
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [tempColumns, setTempColumns] = useState(defaultColumns)
  const [savingConfig, setSavingConfig] = useState(false)

  // Load data
  useEffect(() => {
    loadEnterprises()
    loadTableConfig()
  }, [])

  const loadEnterprises = async () => {
    try {
      const response = await api.get('/enterprises/')
      setEnterprises(Array.isArray(response.data) ? response.data : [])
      setSelectedIds(new Set())
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
      if (response.data?.config) {
        setTableSettings(response.data.config)
      }
    } catch (error) {
      console.error('Failed to load table config:', error)
    }
  }

  // Table config handlers
  const saveTableConfig = async () => {
    setSavingConfig(true)
    try {
      const settings = { ...tableSettings, columns: tempColumns }
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
      setTableSettings({ columns: defaultColumns, sortBy: null, sortOrder: 'asc' })
      setShowConfigModal(false)
    } catch (error) {
      console.error('Failed to reset config:', error)
    }
  }

  // Import handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await api.post('/enterprises/import/preview', formData)
      setImportPreview(response.data)
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
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!importFile || !importPreview) return

    if (!Object.values(importMapping).includes('name')) {
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

  // Card handlers
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
      setShowCreateModal(false)
      setEditData(defaultEnterprise)
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

  // Interaction handlers
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
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === filteredEnterprises.length
        ? new Set()
        : new Set(filteredEnterprises.map(e => e.id))
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Удалить ${selectedIds.size} предприятий?`)) return

    setBulkDeleting(true)
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.delete(`/enterprises/${id}`)))
      await loadEnterprises()
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Bulk delete failed:', error)
      alert('Ошибка при удалении')
    } finally {
      setBulkDeleting(false)
    }
  }

  // Sorting
  const handleSort = (columnId: string) => {
    const column = tableSettings.columns.find(c => c.id === columnId)
    if (!column?.sortable) return

    const newOrder = tableSettings.sortBy === columnId && tableSettings.sortOrder === 'asc' ? 'desc' : 'asc'
    setTableSettings({ ...tableSettings, sortBy: columnId, sortOrder: newOrder })
  }

  // Cell rendering
  const getCategoryBadge = (category: string) => (
    <span className={`category-badge cat-${category}`}>
      {category === 'V' ? 'В' : category === 'G' ? 'Г' : category}
    </span>
  )

  const getStatusBadge = (status: string) => (
    <span className={`status-badge status-${status}`}>{statusLabels[status] || status}</span>
  )

  const getCellValue = (enterprise: Enterprise, columnId: string) => {
    switch (columnId) {
      case 'category': return getCategoryBadge(enterprise.category)
      case 'name': return <strong>{enterprise.name}</strong>
      case 'inn': return enterprise.inn || '—'
      case 'holding': return enterprise.holding || '—'
      case 'industry': return enterprise.industry || '—'
      case 'employee_count': return enterprise.employee_count ? formatNumber(enterprise.employee_count) : '—'
      case 'manager': return enterprise.manager || '—'
      case 'score': return <span className="score-badge">{enterprise.score}</span>
      case 'sales_status': return <span className={`sales-badge sales-${enterprise.sales_status}`}>{salesStatusLabels[enterprise.sales_status]}</span>
      case 'status': return getStatusBadge(enterprise.status)
      case 'bank_penetration': return enterprise.bank_penetration ? `${enterprise.bank_penetration}%` : '—'
      case 'locations': return enterprise.locations || '—'
      case 'contact_person': return enterprise.contact_person || '—'
      case 'contact_phone': return enterprise.contact_phone || '—'
      case 'contact_email': return enterprise.contact_email || '—'
      default: return '—'
    }
  }

  const getSortValue = (enterprise: Enterprise, columnId: string): string | number => {
    const val = enterprise[columnId as keyof Enterprise]
    if (val === null || val === undefined) return ''
    if (typeof val === 'number') return val
    return String(val).toLowerCase()
  }

  // Memoized data
  const visibleColumns = useMemo(() =>
    tableSettings.columns.filter(c => c.visible),
    [tableSettings.columns]
  )

  const filteredEnterprises = useMemo(() => {
    let result = enterprises.filter(e => {
      const matchesSearch = !searchQuery ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.inn?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.holding?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.industry?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.manager?.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = !filterCategory || e.category === filterCategory
      const matchesSales = !filterSalesStatus || e.sales_status === filterSalesStatus
      return matchesSearch && matchesCategory && matchesSales
    })

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
            <button className="btn btn-primary" onClick={() => { setShowCreateModal(true); setEditData(defaultEnterprise) }}>
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

      <EnterpriseFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterSalesStatus={filterSalesStatus}
        setFilterSalesStatus={setFilterSalesStatus}
        filteredCount={filteredEnterprises.length}
        totalCount={enterprises.length}
      />

      {canEdit && (
        <BulkActionsToolbar
          selectedCount={selectedIds.size}
          onBulkDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds(new Set())}
          isDeleting={bulkDeleting}
        />
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
                <button
                  className="btn-settings"
                  onClick={() => { setTempColumns([...tableSettings.columns]); setShowConfigModal(true) }}
                  title="Настроить столбцы"
                >
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
              filteredEnterprises.map(e => (
                <tr
                  key={e.id}
                  onClick={() => openCard(e)}
                  className={`clickable-row ${selectedIds.has(e.id) ? 'selected-row' : ''}`}
                >
                  {canEdit && (
                    <td className="checkbox-cell" onClick={ev => ev.stopPropagation()}>
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
                      onClick={ev => {
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
        <ColumnConfigModal
          columns={tempColumns}
          setColumns={setTempColumns}
          onSave={saveTableConfig}
          onReset={resetTableConfig}
          onClose={() => setShowConfigModal(false)}
          isSaving={savingConfig}
        />
      )}

      {/* Enterprise Card Modal */}
      {selectedEnterprise && (
        <EnterpriseCard
          enterprise={selectedEnterprise}
          editData={editData}
          setEditData={setEditData}
          editMode={editMode}
          setEditMode={setEditMode}
          canEdit={canEdit}
          canEditEntity={canEditEntity}
          isSaving={saving}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onClose={closeCard}
          onSave={handleSave}
          onDelete={handleDelete}
          showAddInteraction={showAddInteraction}
          newInteraction={newInteraction}
          editingInteraction={editingInteraction}
          savingInteraction={savingInteraction}
          onShowAddInteraction={() => { setShowAddInteraction(true); setEditingInteraction(null); setNewInteraction(defaultInteraction) }}
          onCancelInteractionForm={() => { setShowAddInteraction(false); setEditingInteraction(null); setNewInteraction(defaultInteraction) }}
          onNewInteractionChange={setNewInteraction}
          onSaveInteraction={handleAddInteraction}
          onEditInteraction={handleEditInteraction}
          onDeleteInteraction={handleDeleteInteraction}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateEnterpriseModal
          editData={editData}
          setEditData={setEditData}
          onClose={() => { setShowCreateModal(false); setEditData(defaultEnterprise) }}
          onCreate={handleCreate}
          isSaving={saving}
        />
      )}

      {/* Import Mapping Modal */}
      {showImportModal && importPreview && (
        <ImportMappingModal
          file={importFile}
          preview={importPreview}
          mapping={importMapping}
          onUpdateMapping={(col, field) => setImportMapping(prev => ({ ...prev, [col]: field }))}
          onConfirm={handleImportConfirm}
          onClose={closeImportModal}
          isImporting={importing}
        />
      )}
    </div>
  )
}

export default Enterprises
