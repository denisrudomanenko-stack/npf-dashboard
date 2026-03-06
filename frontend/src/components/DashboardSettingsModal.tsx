import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import type { SalesImportPreview, SalesImportResponse } from '../types'

interface DashboardSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

interface DashboardConfig {
  id: number
  key: string
  value: Record<string, any>
  description: string
  category: string
}

interface SalesDataEntry {
  id: number
  track: 'bank' | 'external' | 'zk'
  date: string
  period_type: string
  collections: number
  participants: number
  penetration: number
  employee_contributions: number
  bank_contributions: number
  enterprises: number
  enterprises_total: number
  contracts: number
  dds_count: number
  dds_collections: number
  notes: string
}

type TabId = 'kpi' | 'scoring' | 'risks' | 'data' | 'formulas'

const TABS: { id: TabId; label: string }[] = [
  { id: 'kpi', label: 'KPI и цели' },
  { id: 'scoring', label: 'Скоринг' },
  { id: 'risks', label: 'Матрица рисков' },
  { id: 'data', label: 'Данные продаж' },
  { id: 'formulas', label: 'Формулы' },
]

const defaultBankEntry = {
  track: 'bank' as const,
  date: new Date().toISOString().split('T')[0],
  period_type: 'monthly',
  participants: 0,
  penetration: 0,
  employee_contributions: 0,
  bank_contributions: 0,
  notes: '',
}

const defaultExternalEntry = {
  track: 'external' as const,
  date: new Date().toISOString().split('T')[0],
  period_type: 'monthly',
  collections: 0,
  participants: 0,
  enterprises: 0,
  enterprises_total: 0,
  contracts: 0,
  notes: '',
}

const defaultZkEntry = {
  track: 'zk' as const,
  date: new Date().toISOString().split('T')[0],
  period_type: 'monthly',
  dds_count: 0,
  dds_collections: 0,
  notes: '',
}

function DashboardSettingsModal({ isOpen, onClose, onSave }: DashboardSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('kpi')
  const [configs, setConfigs] = useState<Record<string, DashboardConfig>>({})
  const [bankData, setBankData] = useState<SalesDataEntry[]>([])
  const [externalData, setExternalData] = useState<SalesDataEntry[]>([])
  const [zkData, setZkData] = useState<SalesDataEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for KPI targets (разделено по направлениям)
  const [kpiTargets, setKpiTargets] = useState({
    // КПП в Банке (Трек 1)
    bank_participants_target: 0,
    bank_penetration_target: 0,
    bank_employee_contributions_target: 0,
    bank_bank_contributions_target: 0,
    // Внешние продажи (Трек 2)
    external_enterprises_target: 0,
    external_contracts_target: 0,
    external_participants_target: 0,
    external_collections_target: 0,
    // Продажи в ЗК (Трек 3)
    zk_dds_count_target: 0,
    zk_dds_collections_target: 0,
  })

  // Form state for category rules
  const [categoryRules, setCategoryRules] = useState<Record<string, { min_score: number; max_score: number; label: string; color: string }>>({
    A: { min_score: 80, max_score: 100, label: '', color: '#22c55e' },
    B: { min_score: 60, max_score: 79, label: '', color: '#3b82f6' },
    V: { min_score: 40, max_score: 59, label: '', color: '#f59e0b' },
    G: { min_score: 0, max_score: 39, label: '', color: '#ef4444' },
  })

  // Form state for risk matrix
  const [riskMatrix, setRiskMatrix] = useState({
    severity_thresholds: { low: 0, medium: 0, high: 0 },
    color_scheme: { low: '#4caf50', medium: '#ff9800', high: '#f44336' },
  })

  // Form state for bank settings (headcount for penetration calculation)
  const [bankSettings, setBankSettings] = useState({
    headcount: 0,
    headcount_date: '',
    history: [] as Array<{ date: string; headcount: number; comment: string }>,
  })
  const [newHeadcountEntry, setNewHeadcountEntry] = useState({
    headcount: 0,
    date: new Date().toISOString().split('T')[0],
    comment: '',
  })

  // Form state for new entries
  const [newBankEntry, setNewBankEntry] = useState(defaultBankEntry)
  const [newExternalEntry, setNewExternalEntry] = useState(defaultExternalEntry)
  const [newZkEntry, setNewZkEntry] = useState(defaultZkEntry)

  // Import state
  const [importTrack, setImportTrack] = useState<'bank' | 'external' | 'zk' | null>(null)
  const [importPreview, setImportPreview] = useState<SalesImportPreview | null>(null)
  const [importMapping, setImportMapping] = useState<Record<string, string | null>>({})
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<SalesImportResponse | null>(null)
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'append'>('skip')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load configs when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfigs()
      loadSalesData()
    }
  }, [isOpen])

  const loadConfigs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/dashboard-config/')
      const configsMap: Record<string, DashboardConfig> = {}
      response.data.forEach((config: DashboardConfig) => {
        configsMap[config.key] = config
      })
      setConfigs(configsMap)

      // Update form state from loaded configs
      if (configsMap.kpi_targets) {
        setKpiTargets(prev => ({ ...prev, ...configsMap.kpi_targets.value }))
      }
      if (configsMap.category_rules) {
        setCategoryRules(prev => ({ ...prev, ...configsMap.category_rules.value }))
      }
      if (configsMap.risk_matrix) {
        setRiskMatrix({
          severity_thresholds: configsMap.risk_matrix.value.severity_thresholds || { low: 3, medium: 5, high: 7 },
          color_scheme: configsMap.risk_matrix.value.color_scheme || { low: '#4caf50', medium: '#ff9800', high: '#f44336' },
        })
      }
      if (configsMap.bank_settings) {
        const bs = configsMap.bank_settings.value
        setBankSettings({
          headcount: bs.headcount || 32000,
          headcount_date: bs.headcount_date || new Date().toISOString().split('T')[0],
          history: bs.history || [],
        })
        setNewHeadcountEntry(prev => ({
          ...prev,
          headcount: bs.headcount || 32000,
        }))
      }
    } catch (err) {
      console.error('Failed to load configs:', err)
      setError('Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }

  const loadSalesData = async () => {
    try {
      const [bankResponse, externalResponse, zkResponse] = await Promise.all([
        api.get('/sales-data/?track=bank&limit=20'),
        api.get('/sales-data/?track=external&limit=20'),
        api.get('/sales-data/?track=zk&limit=20'),
      ])
      setBankData(bankResponse.data)
      setExternalData(externalResponse.data)
      setZkData(zkResponse.data)
    } catch (err) {
      console.error('Failed to load sales data:', err)
    }
  }

  const saveConfig = async (key: string, value: Record<string, any>) => {
    setSaving(true)
    try {
      await api.put(`/dashboard-config/${key}`, { value })
      onSave?.()
    } catch (err) {
      console.error('Failed to save config:', err)
      setError('Не удалось сохранить настройки')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveKPI = () => {
    saveConfig('kpi_targets', kpiTargets)
  }

  const handleSaveCategories = () => {
    saveConfig('category_rules', categoryRules)
  }

  const handleSaveRiskMatrix = () => {
    const currentConfig = configs.risk_matrix?.value || {}
    saveConfig('risk_matrix', {
      ...currentConfig,
      severity_thresholds: riskMatrix.severity_thresholds,
      color_scheme: riskMatrix.color_scheme,
    })
  }

  const handleUpdateBankHeadcount = async () => {
    if (!newHeadcountEntry.headcount || !newHeadcountEntry.date) return

    // Add new entry to history
    const newHistory = [
      ...bankSettings.history,
      {
        date: newHeadcountEntry.date,
        headcount: newHeadcountEntry.headcount,
        comment: newHeadcountEntry.comment || 'Обновление численности',
      },
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const newBankSettings = {
      headcount: newHeadcountEntry.headcount,
      headcount_date: newHeadcountEntry.date,
      history: newHistory,
    }

    await saveConfig('bank_settings', newBankSettings)
    setBankSettings(newBankSettings)
    setNewHeadcountEntry({
      headcount: newHeadcountEntry.headcount,
      date: new Date().toISOString().split('T')[0],
      comment: '',
    })
  }

  const handleAddBankEntry = async () => {
    try {
      await api.post('/sales-data/', {
        ...newBankEntry,
        collections: 0,
        enterprises: 0,
        enterprises_total: 0,
        contracts: 0,
        dds_count: 0,
        dds_collections: 0,
      })
      loadSalesData()
      setNewBankEntry(defaultBankEntry)
    } catch (err) {
      console.error('Failed to add bank entry:', err)
      setError('Не удалось добавить запись')
    }
  }

  const handleAddExternalEntry = async () => {
    try {
      await api.post('/sales-data/', {
        ...newExternalEntry,
        penetration: 0,
        employee_contributions: 0,
        bank_contributions: 0,
        dds_count: 0,
        dds_collections: 0,
      })
      loadSalesData()
      setNewExternalEntry(defaultExternalEntry)
    } catch (err) {
      console.error('Failed to add external entry:', err)
      setError('Не удалось добавить запись')
    }
  }

  const handleAddZkEntry = async () => {
    try {
      await api.post('/sales-data/', {
        ...newZkEntry,
        collections: 0,
        participants: 0,
        penetration: 0,
        employee_contributions: 0,
        bank_contributions: 0,
        enterprises: 0,
        enterprises_total: 0,
        contracts: 0,
      })
      loadSalesData()
      setNewZkEntry(defaultZkEntry)
    } catch (err) {
      console.error('Failed to add ZK entry:', err)
      setError('Не удалось добавить запись')
    }
  }

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Удалить эту запись?')) return
    try {
      await api.delete(`/sales-data/${id}`)
      loadSalesData()
    } catch (err) {
      console.error('Failed to delete entry:', err)
    }
  }

  const seedConfigs = async () => {
    try {
      await api.post('/dashboard-config/seed')
      loadConfigs()
    } catch (err) {
      console.error('Failed to seed configs:', err)
    }
  }

  // Import handlers
  const handleImportClick = (track: 'bank' | 'external' | 'zk') => {
    setImportTrack(track)
    setImportPreview(null)
    setImportMapping({})
    setImportFile(null)
    setImportError(null)
    setImportResult(null)
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !importTrack) return

    setImportFile(file)
    setImportLoading(true)
    setImportError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await api.post(`/sales-data/import/preview?track=${importTrack}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImportPreview(response.data)
      setImportMapping(response.data.suggested_mapping)
    } catch (err: any) {
      setImportError(err.response?.data?.detail || 'Ошибка при чтении файла')
    } finally {
      setImportLoading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleMappingChange = (column: string, field: string | null) => {
    setImportMapping(prev => ({ ...prev, [column]: field }))
  }

  const handleImportConfirm = async () => {
    if (!importFile || !importTrack) return

    setImportLoading(true)
    setImportError(null)

    const formData = new FormData()
    formData.append('file', importFile)
    formData.append('mapping', JSON.stringify(importMapping))
    formData.append('track', importTrack)
    formData.append('duplicate_handling', duplicateHandling)

    try {
      const response = await api.post('/sales-data/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImportResult(response.data)
      loadSalesData()
    } catch (err: any) {
      setImportError(err.response?.data?.detail || 'Ошибка при импорте')
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportClose = () => {
    setImportTrack(null)
    setImportPreview(null)
    setImportMapping({})
    setImportFile(null)
    setImportError(null)
    setImportResult(null)
  }

  if (!isOpen) return null

  const renderKPITab = () => (
    <div className="settings-form kpi-tab">
      <h4>Целевые значения KPI</h4>

      <div className="kpi-tracks-3">
        {/* КПП в Банке (Трек 1) */}
        <div className="kpi-track">
          <div className="track-header bank">
            <span className="track-icon">🏦</span>
            <h5>КПП в Банке</h5>
          </div>

          <div className="track-form">
            <div className="form-row">
              <div className="form-group">
                <label>Целевые участники</label>
                <input
                  type="number"
                  value={kpiTargets.bank_participants_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, bank_participants_target: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Целевое проникновение (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={kpiTargets.bank_penetration_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, bank_penetration_target: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Взносы работников (млн)</label>
                <input
                  type="number"
                  step="0.1"
                  value={kpiTargets.bank_employee_contributions_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, bank_employee_contributions_target: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Взносы Банка (млн)</label>
                <input
                  type="number"
                  step="0.1"
                  value={kpiTargets.bank_bank_contributions_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, bank_bank_contributions_target: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Внешние продажи (Трек 2) */}
        <div className="kpi-track">
          <div className="track-header external">
            <span className="track-icon">🏢</span>
            <h5>Внешние продажи</h5>
          </div>

          <div className="track-form">
            <div className="form-row">
              <div className="form-group">
                <label>Целевое кол-во предприятий</label>
                <input
                  type="number"
                  value={kpiTargets.external_enterprises_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, external_enterprises_target: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Целевое кол-во договоров</label>
                <input
                  type="number"
                  value={kpiTargets.external_contracts_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, external_contracts_target: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Целевые участники</label>
                <input
                  type="number"
                  value={kpiTargets.external_participants_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, external_participants_target: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Целевые сборы (млн)</label>
                <input
                  type="number"
                  step="0.1"
                  value={kpiTargets.external_collections_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, external_collections_target: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Продажи в ЗК (Трек 3) */}
        <div className="kpi-track">
          <div className="track-header zk">
            <span className="track-icon">💼</span>
            <h5>Продажи в ЗК</h5>
          </div>

          <div className="track-form">
            <div className="form-row">
              <div className="form-group">
                <label>Целевое кол-во ДДС</label>
                <input
                  type="number"
                  value={kpiTargets.zk_dds_count_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, zk_dds_count_target: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Целевые взносы (млн)</label>
                <input
                  type="number"
                  step="0.1"
                  value={kpiTargets.zk_dds_collections_target}
                  onChange={e => setKpiTargets(prev => ({ ...prev, zk_dds_collections_target: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn-save" onClick={handleSaveKPI} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить KPI'}
        </button>
      </div>

      {/* Bank Settings - Headcount for penetration calculation */}
      <div className="bank-settings-section">
        <h4>Численность Банка</h4>
        <p className="form-hint">
          Численность сотрудников Банка используется для расчёта проникновения КПП.
          Формула: Проникновение (%) = Участники КПП / Численность × 100%
        </p>

        <div className="headcount-current">
          <div className="headcount-value">
            <span className="label">Текущая численность:</span>
            <span className="value">{bankSettings.headcount.toLocaleString('ru-RU')}</span>
            <span className="date">от {new Date(bankSettings.headcount_date).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>

        <div className="headcount-form">
          <h5>Обновить численность</h5>
          <div className="form-row">
            <div className="form-group">
              <label>Численность</label>
              <input
                type="number"
                value={newHeadcountEntry.headcount}
                onChange={e => setNewHeadcountEntry(prev => ({ ...prev, headcount: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="form-group">
              <label>Дата актуальности</label>
              <input
                type="date"
                value={newHeadcountEntry.date}
                onChange={e => setNewHeadcountEntry(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Комментарий</label>
              <input
                type="text"
                placeholder="Причина изменения..."
                value={newHeadcountEntry.comment}
                onChange={e => setNewHeadcountEntry(prev => ({ ...prev, comment: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn-secondary" onClick={handleUpdateBankHeadcount} disabled={saving}>
            Обновить численность
          </button>
        </div>

        {bankSettings.history.length > 0 && (
          <div className="headcount-history">
            <h5>История изменений</h5>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Численность</th>
                  <th>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {bankSettings.history.slice(0, 5).map((entry, idx) => (
                  <tr key={idx}>
                    <td>{new Date(entry.date).toLocaleDateString('ru-RU')}</td>
                    <td>{entry.headcount.toLocaleString('ru-RU')}</td>
                    <td>{entry.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bankSettings.history.length > 5 && (
              <p className="form-hint" style={{ marginTop: 8 }}>
                Показаны последние 5 записей из {bankSettings.history.length}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const renderScoringTab = () => (
    <div className="settings-form">
      <h4>Правила категоризации</h4>
      <p className="form-hint">Пороги баллов для присвоения категории предприятию</p>

      <table className="settings-table">
        <thead>
          <tr>
            <th>Категория</th>
            <th>Мин. балл</th>
            <th>Макс. балл</th>
            <th>Название</th>
            <th>Цвет</th>
          </tr>
        </thead>
        <tbody>
          {(['A', 'B', 'V', 'G'] as const).map(cat => (
            <tr key={cat}>
              <td>
                <span className="cat-badge" style={{ background: categoryRules[cat]?.color }}>
                  {cat === 'V' ? 'В' : cat === 'G' ? 'Г' : cat}
                </span>
              </td>
              <td>
                <input
                  type="number"
                  value={categoryRules[cat]?.min_score || 0}
                  onChange={e => setCategoryRules(prev => ({
                    ...prev,
                    [cat]: { ...prev[cat], min_score: parseInt(e.target.value) || 0 }
                  }))}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={categoryRules[cat]?.max_score || 100}
                  onChange={e => setCategoryRules(prev => ({
                    ...prev,
                    [cat]: { ...prev[cat], max_score: parseInt(e.target.value) || 100 }
                  }))}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={categoryRules[cat]?.label || ''}
                  onChange={e => setCategoryRules(prev => ({
                    ...prev,
                    [cat]: { ...prev[cat], label: e.target.value }
                  }))}
                />
              </td>
              <td>
                <input
                  type="color"
                  value={categoryRules[cat]?.color || '#000000'}
                  onChange={e => setCategoryRules(prev => ({
                    ...prev,
                    [cat]: { ...prev[cat], color: e.target.value }
                  }))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="form-actions">
        <button className="btn-save" onClick={handleSaveCategories} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить правила'}
        </button>
      </div>
    </div>
  )

  const renderRisksTab = () => (
    <div className="settings-form">
      <h4>Настройки матрицы рисков</h4>

      <div className="form-section">
        <h5>Пороги серьёзности</h5>
        <p className="form-hint">Сумма вероятности и влияния для определения уровня</p>

        <div className="form-row">
          <div className="form-group">
            <label>Низкий (до)</label>
            <input
              type="number"
              value={riskMatrix.severity_thresholds.low}
              onChange={e => setRiskMatrix(prev => ({
                ...prev,
                severity_thresholds: { ...prev.severity_thresholds, low: parseInt(e.target.value) || 0 }
              }))}
            />
          </div>
          <div className="form-group">
            <label>Средний (до)</label>
            <input
              type="number"
              value={riskMatrix.severity_thresholds.medium}
              onChange={e => setRiskMatrix(prev => ({
                ...prev,
                severity_thresholds: { ...prev.severity_thresholds, medium: parseInt(e.target.value) || 0 }
              }))}
            />
          </div>
          <div className="form-group">
            <label>Высокий (от)</label>
            <input
              type="number"
              value={riskMatrix.severity_thresholds.high}
              onChange={e => setRiskMatrix(prev => ({
                ...prev,
                severity_thresholds: { ...prev.severity_thresholds, high: parseInt(e.target.value) || 0 }
              }))}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h5>Цветовая схема</h5>
        <div className="form-row">
          <div className="form-group">
            <label>Низкий</label>
            <input
              type="color"
              value={riskMatrix.color_scheme.low}
              onChange={e => setRiskMatrix(prev => ({
                ...prev,
                color_scheme: { ...prev.color_scheme, low: e.target.value }
              }))}
            />
          </div>
          <div className="form-group">
            <label>Средний</label>
            <input
              type="color"
              value={riskMatrix.color_scheme.medium}
              onChange={e => setRiskMatrix(prev => ({
                ...prev,
                color_scheme: { ...prev.color_scheme, medium: e.target.value }
              }))}
            />
          </div>
          <div className="form-group">
            <label>Высокий</label>
            <input
              type="color"
              value={riskMatrix.color_scheme.high}
              onChange={e => setRiskMatrix(prev => ({
                ...prev,
                color_scheme: { ...prev.color_scheme, high: e.target.value }
              }))}
            />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn-save" onClick={handleSaveRiskMatrix} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  )

  const renderDataTab = () => (
    <div className="settings-form data-tab">
      <div className="data-header">
        <h4>Оперативные данные продаж</h4>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.xml"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div className="data-tracks">
        {/* КПП в Банке (Трек 1) */}
        <div className="data-track">
          <div className="track-header bank">
            <span className="track-icon">🏦</span>
            <h5>КПП в Банке</h5>
            <button
              className="btn-import"
              onClick={() => handleImportClick('bank')}
              title="Импорт из Excel/XML"
            >
              📥
            </button>
          </div>

          <div className="track-form">
            <div className="form-row">
              <div className="form-group">
                <label>Дата</label>
                <input
                  type="date"
                  value={newBankEntry.date}
                  onChange={e => setNewBankEntry(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Участники</label>
                <input
                  type="number"
                  value={newBankEntry.participants}
                  onChange={e => setNewBankEntry(prev => ({ ...prev, participants: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Проникновение (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newBankEntry.penetration}
                  onChange={e => setNewBankEntry(prev => ({ ...prev, penetration: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Взносы работн. (млн)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBankEntry.employee_contributions}
                  onChange={e => setNewBankEntry(prev => ({ ...prev, employee_contributions: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Взносы Банка (млн)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBankEntry.bank_contributions}
                  onChange={e => setNewBankEntry(prev => ({ ...prev, bank_contributions: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <button className="btn-add" onClick={handleAddBankEntry}>
              + Добавить запись
            </button>
          </div>

          <div className="track-history">
            {bankData.length === 0 ? (
              <p className="empty-state">Нет данных</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>%</th>
                    <th>Участники</th>
                    <th>Работн.</th>
                    <th>Банк</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bankData.map(entry => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.date).toLocaleDateString('ru-RU')}</td>
                      <td>{entry.penetration?.toFixed(1)}%</td>
                      <td>{entry.participants}</td>
                      <td>{entry.employee_contributions?.toFixed(1)}</td>
                      <td>{entry.bank_contributions?.toFixed(1)}</td>
                      <td>
                        <button
                          className="btn-delete-small"
                          onClick={() => handleDeleteEntry(entry.id)}
                          title="Удалить"
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Внешние продажи (Трек 2) */}
        <div className="data-track">
          <div className="track-header external">
            <span className="track-icon">🏢</span>
            <h5>Внешние продажи</h5>
            <button
              className="btn-import"
              onClick={() => handleImportClick('external')}
              title="Импорт из Excel/XML"
            >
              📥
            </button>
          </div>

          <div className="track-form">
            <div className="form-row">
              <div className="form-group">
                <label>Дата</label>
                <input
                  type="date"
                  value={newExternalEntry.date}
                  onChange={e => setNewExternalEntry(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Предприятий</label>
                <input
                  type="number"
                  value={newExternalEntry.enterprises}
                  onChange={e => setNewExternalEntry(prev => ({ ...prev, enterprises: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Договоров</label>
                <input
                  type="number"
                  value={newExternalEntry.contracts}
                  onChange={e => setNewExternalEntry(prev => ({ ...prev, contracts: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Участники</label>
                <input
                  type="number"
                  value={newExternalEntry.participants}
                  onChange={e => setNewExternalEntry(prev => ({ ...prev, participants: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Сборы (млн)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newExternalEntry.collections}
                  onChange={e => setNewExternalEntry(prev => ({ ...prev, collections: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <button className="btn-add" onClick={handleAddExternalEntry}>
              + Добавить запись
            </button>
          </div>

          <div className="track-history">
            {externalData.length === 0 ? (
              <p className="empty-state">Нет данных</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Предпр.</th>
                    <th>Договоры</th>
                    <th>Участники</th>
                    <th>Сборы</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {externalData.map(entry => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.date).toLocaleDateString('ru-RU')}</td>
                      <td>{entry.enterprises}</td>
                      <td>{entry.contracts}</td>
                      <td>{entry.participants}</td>
                      <td>{entry.collections?.toFixed(2)}</td>
                      <td>
                        <button
                          className="btn-delete-small"
                          onClick={() => handleDeleteEntry(entry.id)}
                          title="Удалить"
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Продажи в ЗК (Трек 3) */}
        <div className="data-track">
          <div className="track-header zk">
            <span className="track-icon">💼</span>
            <h5>Продажи в ЗК</h5>
            <button
              className="btn-import"
              onClick={() => handleImportClick('zk')}
              title="Импорт из Excel/XML"
            >
              📥
            </button>
          </div>

          <div className="track-form">
            <div className="form-row">
              <div className="form-group">
                <label>Дата</label>
                <input
                  type="date"
                  value={newZkEntry.date}
                  onChange={e => setNewZkEntry(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Кол-во ДДС</label>
                <input
                  type="number"
                  value={newZkEntry.dds_count}
                  onChange={e => setNewZkEntry(prev => ({ ...prev, dds_count: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Сумма взносов (млн)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newZkEntry.dds_collections}
                  onChange={e => setNewZkEntry(prev => ({ ...prev, dds_collections: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <button className="btn-add" onClick={handleAddZkEntry}>
              + Добавить запись
            </button>
          </div>

          <div className="track-history">
            {zkData.length === 0 ? (
              <p className="empty-state">Нет данных</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Кол-во ДДС</th>
                    <th>Взносы</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {zkData.map(entry => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.date).toLocaleDateString('ru-RU')}</td>
                      <td>{entry.dds_count}</td>
                      <td>{entry.dds_collections?.toFixed(2)}</td>
                      <td>
                        <button
                          className="btn-delete-small"
                          onClick={() => handleDeleteEntry(entry.id)}
                          title="Удалить"
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderFormulasTab = () => {
    const formulas = configs.formulas?.value || {}

    return (
      <div className="settings-form">
        <h4>Формулы расчёта метрик</h4>
        <p className="form-hint">Описание формул, используемых для расчёта показателей</p>

        <table className="settings-table">
          <thead>
            <tr>
              <th>Метрика</th>
              <th>Формула</th>
              <th>Описание</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(formulas).map(([key, value]: [string, any]) => (
              <tr key={key}>
                <td><code>{key}</code></td>
                <td><code>{value.formula}</code></td>
                <td>{value.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="form-hint" style={{ marginTop: 16 }}>
          Формулы используются для расчёта метрик на основе данных из БД.
          Редактирование формул требует изменения кода бэкенда.
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'kpi': return renderKPITab()
      case 'scoring': return renderScoringTab()
      case 'risks': return renderRisksTab()
      case 'data': return renderDataTab()
      case 'formulas': return renderFormulasTab()
      default: return null
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Настройки дашборда</h3>
          <div className="header-actions">
            {Object.keys(configs).length === 0 && !loading && (
              <button className="btn-secondary small" onClick={seedConfigs}>
                Инициализировать настройки
              </button>
            )}
            <button className="modal-close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="settings-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-content">
          {loading ? (
            <div className="loading-state">Загрузка настроек...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : (
            renderTabContent()
          )}
        </div>

        <style>{`
          .settings-modal {
            background: white;
            border-radius: 12px;
            width: 1100px;
            max-width: 95vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .settings-modal .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
          }

          .settings-modal .modal-header h3 {
            margin: 0;
            font-size: 18px;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .settings-tabs {
            display: flex;
            gap: 4px;
            padding: 12px 24px;
            background: #f8f9fa;
            border-bottom: 1px solid var(--border);
          }

          .settings-tab {
            padding: 8px 16px;
            border: none;
            background: transparent;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            color: var(--text-muted);
            transition: all 0.2s;
          }

          .settings-tab:hover {
            background: #e8e8e8;
            color: var(--text);
          }

          .settings-tab.active {
            background: var(--primary);
            color: white;
          }

          .settings-content {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
          }

          .loading-state,
          .error-state,
          .empty-state {
            text-align: center;
            padding: 24px;
            color: var(--text-muted);
            font-size: 13px;
          }

          .error-state {
            color: #dc2626;
          }

          .settings-form h4 {
            margin: 0 0 16px;
            font-size: 16px;
          }

          .settings-form h5 {
            margin: 24px 0 12px;
            font-size: 14px;
            color: var(--text-muted);
          }

          .form-hint {
            font-size: 12px;
            color: var(--text-muted);
            margin-bottom: 16px;
          }

          .form-section {
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
          }

          .form-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin-bottom: 12px;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .form-group.full-width {
            grid-column: 1 / -1;
          }

          .form-group label {
            font-size: 11px;
            font-weight: 500;
            color: var(--text-muted);
          }

          .form-group input,
          .form-group select {
            padding: 8px 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 13px;
          }

          .form-group input[type="color"] {
            width: 50px;
            height: 32px;
            padding: 2px;
            cursor: pointer;
          }

          .form-actions {
            margin-top: 20px;
            display: flex;
            gap: 12px;
          }

          .settings-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }

          .settings-table th,
          .settings-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--border);
          }

          .settings-table th {
            font-weight: 600;
            color: var(--text-muted);
            font-size: 11px;
            text-transform: uppercase;
          }

          .settings-table input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid var(--border);
            border-radius: 4px;
            font-size: 13px;
          }

          .settings-table input[type="number"] {
            width: 70px;
          }

          .settings-table input[type="color"] {
            width: 40px;
            height: 28px;
          }

          .cat-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            color: white;
            font-weight: 700;
            font-size: 12px;
          }

          /* Data Tab Styles */
          .data-tab {
            padding: 0 !important;
          }

          .data-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 0 16px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 20px;
          }

          .data-header h4 {
            margin: 0;
          }

          /* KPI Tab Styles */
          .kpi-tab {
            padding: 0 !important;
          }

          .kpi-tracks {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 20px;
          }

          .kpi-tracks-3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 20px;
          }

          .kpi-track {
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow: hidden;
          }

          .kpi-track .track-form {
            padding: 16px;
            background: white;
          }

          .data-tracks {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }

          .data-track {
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow: hidden;
          }

          .track-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            font-weight: 600;
          }

          .track-header.bank {
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            border-bottom: 2px solid #22c55e;
          }

          .track-header.external {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            border-bottom: 2px solid #3b82f6;
          }

          .track-header.zk {
            background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
            border-bottom: 2px solid #6366f1;
          }

          .track-icon {
            font-size: 20px;
          }

          .track-header h5 {
            margin: 0;
            font-size: 14px;
            flex: 1;
          }

          .track-badge {
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 10px;
            background: rgba(0,0,0,0.1);
            font-weight: 500;
          }

          .track-form {
            padding: 16px;
            background: #fafafa;
            border-bottom: 1px solid var(--border);
          }

          .track-history {
            padding: 12px;
            max-height: 200px;
            overflow-y: auto;
          }

          .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          .data-table th,
          .data-table td {
            padding: 6px 8px;
            text-align: left;
            border-bottom: 1px solid #eee;
          }

          .data-table th {
            font-weight: 600;
            color: var(--text-muted);
            font-size: 10px;
            text-transform: uppercase;
          }

          .btn-save {
            padding: 10px 20px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          }

          .btn-save:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .btn-secondary {
            padding: 8px 16px;
            background: #f0f0f0;
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
          }

          .btn-secondary.small {
            padding: 6px 12px;
            font-size: 12px;
          }

          .btn-secondary:hover {
            background: #e8e8e8;
          }

          .btn-add {
            width: 100%;
            padding: 8px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            margin-top: 8px;
          }

          .btn-add:hover {
            opacity: 0.9;
          }

          .btn-delete-small {
            width: 20px;
            height: 20px;
            border: none;
            background: #fee2e2;
            color: #dc2626;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
          }

          .btn-delete-small:hover {
            background: #fecaca;
          }

          code {
            font-family: monospace;
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
          }

          /* Bank Settings Section */
          .bank-settings-section {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 2px solid var(--border);
          }

          .bank-settings-section h4 {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .bank-settings-section h4::before {
            content: '🏛️';
          }

          .headcount-current {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border: 1px solid #86efac;
            border-radius: 10px;
            padding: 16px 20px;
            margin-bottom: 20px;
          }

          .headcount-value {
            display: flex;
            align-items: baseline;
            gap: 12px;
            flex-wrap: wrap;
          }

          .headcount-value .label {
            font-size: 13px;
            color: var(--text-muted);
          }

          .headcount-value .value {
            font-size: 28px;
            font-weight: 700;
            color: #15803d;
          }

          .headcount-value .date {
            font-size: 12px;
            color: var(--text-muted);
            background: white;
            padding: 4px 10px;
            border-radius: 12px;
          }

          .headcount-form {
            background: #fafafa;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 20px;
          }

          .headcount-form h5 {
            margin: 0 0 12px !important;
            font-size: 13px;
            color: var(--text);
          }

          .headcount-form .form-row {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
          }

          .headcount-form .form-group {
            flex: 1;
          }

          .headcount-history {
            background: white;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
          }

          .headcount-history h5 {
            margin: 0 0 12px !important;
            font-size: 13px;
            color: var(--text);
          }

          @media (max-width: 900px) {
            .kpi-tracks-3 {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 1100px) {
            .data-tracks {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 800px) {
            .data-tracks,
            .kpi-tracks {
              grid-template-columns: 1fr;
            }

            .headcount-form .form-row {
              flex-direction: column;
            }
          }

          /* Import button styles */
          .btn-import {
            width: 28px;
            height: 28px;
            border: none;
            background: rgba(255,255,255,0.3);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          }

          .btn-import:hover {
            background: rgba(255,255,255,0.5);
          }

          /* Import modal styles */
          .import-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
          }

          .import-modal {
            background: white;
            border-radius: 12px;
            width: 700px;
            max-width: 95vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .import-modal .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
          }

          .import-modal .modal-header h4 {
            margin: 0;
            font-size: 16px;
          }

          .import-modal .modal-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
          }

          .import-modal .modal-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }

          .import-hint {
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 13px;
            color: var(--text-muted);
            background: #f8fafc;
            border-radius: 6px;
          }

          .import-hint a {
            text-decoration: none;
          }

          .import-hint a:hover {
            text-decoration: underline;
          }

          .import-info {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            font-size: 13px;
          }

          .import-info .file-name {
            font-weight: 600;
            color: var(--primary);
          }

          .import-info .method-badge {
            display: inline-block;
            padding: 2px 8px;
            background: #dbeafe;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 8px;
          }

          .mapping-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }

          .mapping-table th,
          .mapping-table td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid var(--border);
          }

          .mapping-table th {
            font-weight: 600;
            color: var(--text-muted);
            font-size: 11px;
            text-transform: uppercase;
            background: #f8f9fa;
          }

          .mapping-table select {
            width: 100%;
            padding: 6px 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 13px;
          }

          .mapping-table .sample {
            font-size: 11px;
            color: var(--text-muted);
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .duplicate-options {
            margin-top: 16px;
            padding: 12px 16px;
            background: #fafafa;
            border-radius: 8px;
          }

          .duplicate-options h5 {
            margin: 0 0 10px;
            font-size: 13px;
          }

          .duplicate-options .radio-group {
            display: flex;
            gap: 16px;
          }

          .duplicate-options label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            cursor: pointer;
          }

          .import-result {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .import-result.success {
            background: #f0fdf4;
            border: 1px solid #86efac;
          }

          .import-result.error {
            background: #fef2f2;
            border: 1px solid #fecaca;
          }

          .import-result h5 {
            margin: 0 0 8px;
            font-size: 14px;
          }

          .import-result .stats {
            display: flex;
            gap: 20px;
            font-size: 13px;
          }

          .import-result .stats span {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .import-result .errors {
            margin-top: 12px;
            font-size: 12px;
            color: #dc2626;
          }

          .import-result .errors li {
            margin-bottom: 4px;
          }
        `}</style>
      </div>

      {/* Import Modal */}
      {(importPreview || importLoading || importResult) && (
        <div className="import-modal-backdrop" onClick={handleImportClose}>
          <div className="import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>
                Импорт данных: {importTrack === 'bank' ? 'КПП в Банке' : importTrack === 'external' ? 'Внешние продажи' : 'Продажи в ЗК'}
              </h4>
              <button className="modal-close" onClick={handleImportClose}>×</button>
            </div>

            <div className="modal-content">
              <div className="import-hint">
                Поддерживаются форматы: Excel (.xlsx, .xls), CSV и XML.{' '}
                <a
                  href={`/api/v1/sales-data/export/sample-xml?track=${importTrack}`}
                  download
                  style={{ color: 'var(--primary)' }}
                >
                  Скачать образец XML
                </a>
              </div>

              {importLoading && !importPreview && (
                <div className="loading-state">Загрузка файла...</div>
              )}

              {importError && (
                <div className="import-result error">
                  <h5>Ошибка</h5>
                  <p>{importError}</p>
                </div>
              )}

              {importResult && (
                <div className={`import-result ${importResult.errors?.length ? 'error' : 'success'}`}>
                  <h5>{importResult.message}</h5>
                  <div className="stats">
                    <span>✅ Импортировано: {importResult.imported}</span>
                    {importResult.skipped > 0 && <span>⏭️ Пропущено: {importResult.skipped}</span>}
                    {importResult.updated > 0 && <span>🔄 Обновлено: {importResult.updated}</span>}
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="errors">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {importPreview && !importResult && (
                <>
                  <div className="import-info">
                    <span className="file-name">{importFile?.name}</span>
                    <span className="method-badge">
                      {importPreview.mapping_method === 'llm' ? '🤖 AI маппинг' : '📋 Авто-маппинг'}
                    </span>
                    <span style={{ marginLeft: 12 }}>
                      Строк: {importPreview.total_rows}
                    </span>
                  </div>

                  <table className="mapping-table">
                    <thead>
                      <tr>
                        <th>Колонка в файле</th>
                        <th>Пример данных</th>
                        <th>Поле системы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.columns.map(col => (
                        <tr key={col}>
                          <td>{col}</td>
                          <td className="sample">
                            {importPreview.sample_data[0]?.[col] || '—'}
                          </td>
                          <td>
                            <select
                              value={importMapping[col] || ''}
                              onChange={e => handleMappingChange(col, e.target.value || null)}
                            >
                              <option value="">— Не импортировать —</option>
                              {Object.entries(importPreview.available_fields).map(([key, info]) => (
                                <option key={key} value={key}>
                                  {info.label} {info.required ? '*' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="duplicate-options">
                    <h5>При дублировании даты:</h5>
                    <div className="radio-group">
                      <label>
                        <input
                          type="radio"
                          name="duplicate"
                          checked={duplicateHandling === 'skip'}
                          onChange={() => setDuplicateHandling('skip')}
                        />
                        Пропустить
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="duplicate"
                          checked={duplicateHandling === 'update'}
                          onChange={() => setDuplicateHandling('update')}
                        />
                        Обновить
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="duplicate"
                          checked={duplicateHandling === 'append'}
                          onChange={() => setDuplicateHandling('append')}
                        />
                        Добавить новую
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleImportClose}>
                {importResult ? 'Закрыть' : 'Отмена'}
              </button>
              {importPreview && !importResult && (
                <button
                  className="btn-save"
                  onClick={handleImportConfirm}
                  disabled={importLoading || !Object.values(importMapping).some(v => v === 'date')}
                >
                  {importLoading ? 'Импорт...' : 'Импортировать'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardSettingsModal
