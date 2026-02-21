import { useState, useEffect } from 'react'
import { api } from '../services/api'
import DashboardSettingsModal from '../components/DashboardSettingsModal'

// Types
interface KPIData {
  bank: {
    participants: { current: number; target: number }
    penetration: { current: number; target: number }
    employeeContributions: { current: number; target: number }
    bankContributions: { current: number; target: number }
    dataDate: string | null
  }
  external: {
    enterprises: { inWork: number; total: number }
    contracts: { current: number; target: number }
    participants: { current: number; target: number }
    collections: { current: number; target: number }
    dataDate: string | null
  }
  zk: {
    ddsCount: { current: number; target: number }
    ddsCollections: { current: number; target: number }
    dataDate: string | null
  }
}

interface TimelineTask {
  id: string
  title: string
  startQ: number
  endQ: number
  track: 'internal' | 'external' | 'both'
  status: 'completed' | 'in_progress' | 'planned'
}

interface Enterprise {
  id: number
  name: string
  score: number
  category: 'A' | 'B' | 'V' | 'G'
  status: 'planned' | 'contact' | 'contract' | 'launched'
}

interface Risk {
  id: string
  title: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high' | 'critical'
  mitigation: string
}

interface Milestone {
  id: string
  month: string
  title: string
  status: 'completed' | 'in_progress' | 'planned'
}

// Default data (used while loading)
const defaultKpiData: KPIData = {
  bank: {
    participants: { current: 0, target: 0 },
    penetration: { current: 0, target: 0 },
    employeeContributions: { current: 0, target: 0 },
    bankContributions: { current: 0, target: 0 },
    dataDate: null
  },
  external: {
    enterprises: { inWork: 0, total: 0 },
    contracts: { current: 0, target: 0 },
    participants: { current: 0, target: 0 },
    collections: { current: 0, target: 0 },
    dataDate: null
  },
  zk: {
    ddsCount: { current: 0, target: 0 },
    ddsCollections: { current: 0, target: 0 },
    dataDate: null
  }
}

// Format date for display
const formatDataDate = (dateStr: string | null): string => {
  if (!dateStr) return 'нет актуальных данных'
  const date = new Date(dateStr)
  return 'на ' + date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface NewTaskForm {
  title: string
  track: 'internal' | 'external' | 'both'
  startQ: number
  endQ: number
  status: 'planned' | 'in_progress' | 'completed'
}

const emptyTaskForm: NewTaskForm = {
  title: '',
  track: 'external',
  startQ: 1,
  endQ: 1,
  status: 'planned'
}

interface FunnelStats {
  planned: number
  contact: number
  contract: number
  launched: number
}

interface DashboardData {
  kpi: KPIData
  timeline: TimelineTask[]
  pipeline: { A: Enterprise[]; B: Enterprise[]; V: Enterprise[]; G: Enterprise[] }
  funnel: FunnelStats
  risks: Risk[]
  milestones: Milestone[]
}

function Dashboard() {
  const [activeTrack, setActiveTrack] = useState<'all' | 'internal' | 'external'>('all')
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState<NewTaskForm>(emptyTaskForm)
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<TimelineTask | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'archive'; task: TimelineTask } | null>(null)
  const [showArchive, setShowArchive] = useState(false)
  const [archivedTasks, setArchivedTasks] = useState<TimelineTask[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Data from API
  const [kpiData, setKpiData] = useState<KPIData>(defaultKpiData)
  const [tasks, setTasks] = useState<TimelineTask[]>([])
  const [enterprises, setEnterprises] = useState<{ A: Enterprise[]; B: Enterprise[]; V: Enterprise[]; G: Enterprise[] }>({ A: [], B: [], V: [], G: [] })
  const [funnelStats, setFunnelStats] = useState<FunnelStats>({ planned: 0, contact: 0, contract: 0, launched: 0 })
  const [risks, setRisks] = useState<Risk[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])

  // Load dashboard data
  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/')
      const data: DashboardData = response.data
      setKpiData(data.kpi)
      setTasks(data.timeline)
      setEnterprises(data.pipeline)
      setFunnelStats(data.funnel)
      setRisks(data.risks)
      setMilestones(data.milestones)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter timeline by track
  const filteredTasks = activeTrack === 'all'
    ? tasks
    : tasks.filter(t => t.track === activeTrack || t.track === 'both')

  // Add new task
  const handleAddTask = async () => {
    if (!newTask.title.trim()) return

    try {
      const params = new URLSearchParams({
        title: newTask.title.trim(),
        track: newTask.track,
        start_q: String(newTask.startQ),
        end_q: String(newTask.endQ),
        status: newTask.status
      })

      const response = await api.post(`/dashboard/tasks?${params.toString()}`)
      const savedTask: TimelineTask = response.data

      setTasks(prev => [...prev, savedTask])
      setNewTask(emptyTaskForm)
      setShowAddTask(false)
    } catch (error) {
      console.error('Failed to save task:', error)
      alert('Ошибка сохранения задачи')
    }
  }

  // Close modal and reset form
  const handleCloseModal = () => {
    setShowAddTask(false)
    setEditingTask(null)
    setNewTask(emptyTaskForm)
  }

  // Delete task
  const handleDeleteTask = async () => {
    if (!confirmAction || confirmAction.type !== 'delete') return

    try {
      await api.delete(`/dashboard/tasks/${confirmAction.task.id}`)
      setTasks(prev => prev.filter(t => t.id !== confirmAction.task.id))
      setConfirmAction(null)
    } catch (error) {
      console.error('Failed to delete task:', error)
      alert('Ошибка удаления задачи')
    }
  }

  // Archive task
  const handleArchiveTask = async () => {
    if (!confirmAction || confirmAction.type !== 'archive') return

    try {
      await api.post(`/dashboard/tasks/${confirmAction.task.id}/archive`)
      setTasks(prev => prev.filter(t => t.id !== confirmAction.task.id))
      setConfirmAction(null)
    } catch (error) {
      console.error('Failed to archive task:', error)
      alert('Ошибка архивирования задачи')
    }
  }

  // Open edit modal
  const handleEditTask = (task: TimelineTask) => {
    setEditingTask(task)
    setNewTask({
      title: task.title,
      track: task.track,
      startQ: task.startQ,
      endQ: task.endQ,
      status: task.status
    })
    setShowAddTask(true)
  }

  // Save edited task
  const handleSaveEdit = async () => {
    if (!editingTask || !newTask.title.trim()) return

    try {
      const params = new URLSearchParams({
        title: newTask.title.trim(),
        track: newTask.track,
        start_q: String(newTask.startQ),
        end_q: String(newTask.endQ),
        status: newTask.status
      })

      const response = await api.patch(`/dashboard/tasks/${editingTask.id}?${params.toString()}`)
      const updatedTask: TimelineTask = response.data

      setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t))
      setEditingTask(null)
      setNewTask(emptyTaskForm)
      setShowAddTask(false)
    } catch (error) {
      console.error('Failed to update task:', error)
      alert('Ошибка обновления задачи')
    }
  }

  // Load archived tasks
  const loadArchivedTasks = async () => {
    setArchiveLoading(true)
    try {
      const response = await api.get('/dashboard/tasks/archived')
      setArchivedTasks(response.data)
    } catch (error) {
      console.error('Failed to load archived tasks:', error)
    } finally {
      setArchiveLoading(false)
    }
  }

  // Open archive modal
  useEffect(() => {
    if (showArchive) {
      loadArchivedTasks()
    }
  }, [showArchive])

  // Restore task from archive
  const handleRestoreTask = async (task: TimelineTask) => {
    try {
      const params = new URLSearchParams({ status: 'planned' })
      await api.patch(`/dashboard/tasks/${task.id}?${params.toString()}`)
      setArchivedTasks(prev => prev.filter(t => t.id !== task.id))
      // Reload main tasks
      loadDashboardData()
    } catch (error) {
      console.error('Failed to restore task:', error)
      alert('Ошибка восстановления задачи')
    }
  }

  // Enterprises already grouped by category from API
  const enterprisesByCategory = enterprises

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      A: 'Быстрые победы',
      B: 'Рабочие кейсы',
      V: 'Длинные проекты',
      G: 'Заморозка'
    }
    return labels[cat] || cat
  }

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return '✓'
    if (status === 'in_progress') return '◐'
    return '○'
  }

  const getRiskPosition = (prob: string, impact: string) => {
    const probMap: Record<string, number> = { low: 1, medium: 2, high: 3 }
    const impactMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
    return { x: probMap[prob], y: impactMap[impact] }
  }

  // Calculate current date position on timeline (percentage of year)
  const getCurrentDatePosition = () => {
    const now = new Date()
    const yearStart = new Date(2026, 0, 1)
    const yearEnd = new Date(2026, 11, 31)

    if (now < yearStart) return 0
    if (now > yearEnd) return 100

    const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
    const daysPassed = (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
    return (daysPassed / totalDays) * 100
  }

  const currentDatePosition = getCurrentDatePosition()

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Дашборд «Корпоративные продажи НПФ»</h1>
          <span className="date-badge">
            по состоянию на {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        </div>
        <div className="header-actions">
          {loading && <span className="loading-indicator">Загрузка...</span>}
          <button className="btn-settings" onClick={() => setSettingsOpen(true)} title="Настройки дашборда">
            Настройки
          </button>
        </div>
      </header>

      {/* KPI Cards - 3 Groups */}
      {/* Group 1: Внешние продажи */}
      <section className="kpi-group">
        <h3 className="kpi-group-title">Внешние продажи</h3>
        <div className="kpi-section">
          <div className="kpi-card kpi-highlight">
            <div className="kpi-icon">💰</div>
            <div className="kpi-content">
              <div className="kpi-label">Взносы</div>
              <div className="kpi-value">
                <span className="current">{kpiData.external.collections.current}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.external.collections.target}</span>
              </div>
              <div className="kpi-unit">млн руб</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.external.collections.target > 0 ? Math.min((kpiData.external.collections.current / kpiData.external.collections.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.external.collections.target > 0 ? Math.round((kpiData.external.collections.current / kpiData.external.collections.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.external.dataDate)}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">🏢</div>
            <div className="kpi-content">
              <div className="kpi-label">Предприятия</div>
              <div className="kpi-value">
                <span className="current">{kpiData.external.enterprises.inWork}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.external.enterprises.total}</span>
              </div>
              <div className="kpi-unit">в работе / всего</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.external.enterprises.total > 0 ? Math.min((kpiData.external.enterprises.inWork / kpiData.external.enterprises.total) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.external.enterprises.total > 0 ? Math.round((kpiData.external.enterprises.inWork / kpiData.external.enterprises.total) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.external.dataDate)}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">📝</div>
            <div className="kpi-content">
              <div className="kpi-label">Договоры</div>
              <div className="kpi-value">
                <span className="current">{kpiData.external.contracts.current}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.external.contracts.target}</span>
              </div>
              <div className="kpi-unit">шт</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.external.contracts.target > 0 ? Math.min((kpiData.external.contracts.current / kpiData.external.contracts.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.external.contracts.target > 0 ? Math.round((kpiData.external.contracts.current / kpiData.external.contracts.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.external.dataDate)}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">👥</div>
            <div className="kpi-content">
              <div className="kpi-label">Участники</div>
              <div className="kpi-value">
                <span className="current">{kpiData.external.participants.current.toLocaleString()}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.external.participants.target.toLocaleString()}</span>
              </div>
              <div className="kpi-unit">человек</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.external.participants.target > 0 ? Math.min((kpiData.external.participants.current / kpiData.external.participants.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.external.participants.target > 0 ? Math.round((kpiData.external.participants.current / kpiData.external.participants.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.external.dataDate)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Group 2: КПП в Банке */}
      <section className="kpi-group">
        <h3 className="kpi-group-title">КПП в Банке</h3>
        <div className="kpi-section">
          <div className="kpi-card kpi-highlight">
            <div className="kpi-icon">👥</div>
            <div className="kpi-content">
              <div className="kpi-label">Участники</div>
              <div className="kpi-value">
                <span className="current">{kpiData.bank.participants.current.toLocaleString()}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.bank.participants.target.toLocaleString()}</span>
              </div>
              <div className="kpi-unit">человек</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.bank.participants.target > 0 ? Math.min((kpiData.bank.participants.current / kpiData.bank.participants.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.bank.participants.target > 0 ? Math.round((kpiData.bank.participants.current / kpiData.bank.participants.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.bank.dataDate)}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">📊</div>
            <div className="kpi-content">
              <div className="kpi-label">Проникновение</div>
              <div className="kpi-value">
                <span className="current">{kpiData.bank.penetration.current}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.bank.penetration.target}%</span>
              </div>
              <div className="kpi-unit">% от всего</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.bank.penetration.target > 0 ? Math.min((kpiData.bank.penetration.current / kpiData.bank.penetration.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.bank.penetration.target > 0 ? Math.round((kpiData.bank.penetration.current / kpiData.bank.penetration.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.bank.dataDate)}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">💰</div>
            <div className="kpi-content">
              <div className="kpi-label">Взносы работников</div>
              <div className="kpi-value">
                <span className="current">{kpiData.bank.employeeContributions.current}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.bank.employeeContributions.target}</span>
              </div>
              <div className="kpi-unit">млн руб</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.bank.employeeContributions.target > 0 ? Math.min((kpiData.bank.employeeContributions.current / kpiData.bank.employeeContributions.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.bank.employeeContributions.target > 0 ? Math.round((kpiData.bank.employeeContributions.current / kpiData.bank.employeeContributions.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.bank.dataDate)}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">🏦</div>
            <div className="kpi-content">
              <div className="kpi-label">Взносы Банка</div>
              <div className="kpi-value">
                <span className="current">{kpiData.bank.bankContributions.current}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.bank.bankContributions.target}</span>
              </div>
              <div className="kpi-unit">млн руб</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.bank.bankContributions.target > 0 ? Math.min((kpiData.bank.bankContributions.current / kpiData.bank.bankContributions.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.bank.bankContributions.target > 0 ? Math.round((kpiData.bank.bankContributions.current / kpiData.bank.bankContributions.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.bank.dataDate)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Group 3: Продажи в ЗК */}
      <section className="kpi-group kpi-group-zk">
        <h3 className="kpi-group-title">Продажи в ЗК</h3>
        <div className="kpi-section kpi-section-zk">
          <div className="kpi-card kpi-highlight">
            <div className="kpi-icon">📋</div>
            <div className="kpi-content">
              <div className="kpi-label">Количество ДДС</div>
              <div className="kpi-value">
                <span className="current">{kpiData.zk.ddsCount.current.toLocaleString()}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.zk.ddsCount.target.toLocaleString()}</span>
              </div>
              <div className="kpi-unit">договоров</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.zk.ddsCount.target > 0 ? Math.min((kpiData.zk.ddsCount.current / kpiData.zk.ddsCount.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.zk.ddsCount.target > 0 ? Math.round((kpiData.zk.ddsCount.current / kpiData.zk.ddsCount.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.zk.dataDate)}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">💵</div>
            <div className="kpi-content">
              <div className="kpi-label">Сумма взносов</div>
              <div className="kpi-value">
                <span className="current">{kpiData.zk.ddsCollections.current}</span>
                <span className="separator">/</span>
                <span className="target">{kpiData.zk.ddsCollections.target}</span>
              </div>
              <div className="kpi-unit">млн руб</div>
              <div className="kpi-progress">
                <div className="kpi-bar">
                  <div
                    className="kpi-bar-fill"
                    style={{ width: `${kpiData.zk.ddsCollections.target > 0 ? Math.min((kpiData.zk.ddsCollections.current / kpiData.zk.ddsCollections.target) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="kpi-percent">{kpiData.zk.ddsCollections.target > 0 ? Math.round((kpiData.zk.ddsCollections.current / kpiData.zk.ddsCollections.target) * 100) : 0}%</span>
              </div>
              <div className="kpi-date">{formatDataDate(kpiData.zk.dataDate)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Track Tabs */}
      <section className="track-tabs">
        <div className="tabs-group">
          <button
            className={`track-tab ${activeTrack === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTrack('all')}
          >
            Все задачи
          </button>
          <button
            className={`track-tab ${activeTrack === 'internal' ? 'active' : ''}`}
            onClick={() => setActiveTrack('internal')}
            title="Трек 1: Масштабирование программы для сотрудников Банка. Текущее проникновение 9%, цель — 17%."
          >
            <span className="tab-dot internal"></span>
            Трек 1: Сотрудники Банка
          </button>
          <button
            className={`track-tab ${activeTrack === 'external' ? 'active' : ''}`}
            onClick={() => setActiveTrack('external')}
            title="Трек 2: Построение корпоративного канала с нуля. Целевой пул 30-50 предприятий, план сборов 3 млрд руб."
          >
            <span className="tab-dot external"></span>
            Трек 2: Внешние клиенты
          </button>
        </div>
        <button className="btn-add-task" onClick={() => setShowAddTask(true)}>
          + Задача
        </button>
      </section>

      {/* Timeline */}
      <section className="timeline-section">
        <div className="timeline-header-row">
          <div className="timeline-title-group">
            <h2>Диаграмма реализации проектов</h2>
            <button className="btn-archive-link" onClick={() => setShowArchive(true)} title="Показать архивные задачи">
              📁 Архив
            </button>
          </div>
          <div className="timeline-legend">
            <div className="legend-group">
              <span className="legend-title">Статус:</span>
              <span className="legend-item"><span className="legend-dot status-completed"></span>Завершено</span>
              <span className="legend-item"><span className="legend-dot status-in_progress"></span>В работе</span>
              <span className="legend-item"><span className="legend-dot status-planned"></span>Запланировано</span>
            </div>
            <div className="legend-group">
              <span className="legend-title">Трек:</span>
              <span className="legend-item"><span className="legend-bar track-internal"></span>Внутренний</span>
              <span className="legend-item"><span className="legend-bar track-external"></span>Внешний</span>
              <span className="legend-item"><span className="legend-bar track-both"></span>Оба</span>
            </div>
          </div>
        </div>
        <div className="timeline-grid">
          <div className="timeline-header">
            <div className="timeline-label"></div>
            <div className="quarter-col">Q1 2026</div>
            <div className="quarter-col">Q2 2026</div>
            <div className="quarter-col">Q3 2026</div>
            <div className="quarter-col">Q4 2026</div>
          </div>
          {filteredTasks.map(task => (
            <div key={task.id} className="timeline-row">
              <div className="timeline-label" title={task.title}>
                {task.title}
              </div>
              <div className="timeline-bars">
                <div
                  className={`timeline-bar status-${task.status} track-${task.track}`}
                  style={{
                    left: `${(task.startQ - 1) * 25}%`,
                    width: `${(task.endQ - task.startQ + 1) * 25}%`
                  }}
                />
              </div>
              <div className="task-actions">
                <button
                  className="action-btn edit"
                  onClick={() => handleEditTask(task)}
                  title="Редактировать"
                >
                  ✎
                </button>
                <button
                  className="action-btn archive"
                  onClick={() => setConfirmAction({ type: 'archive', task })}
                  title="Архивировать"
                >
                  📁
                </button>
                <button
                  className="action-btn delete"
                  onClick={() => setConfirmAction({ type: 'delete', task })}
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {/* Current date indicator line */}
          <div className="current-date-line-container">
            <div className="timeline-label"></div>
            <div className="current-date-line-wrapper">
              <div
                className="current-date-line"
                style={{ left: `${currentDatePosition}%` }}
                title={`Сегодня: ${new Date().toLocaleDateString('ru-RU')}`}
              >
                <span className="current-date-label">Сегодня</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="main-grid">
        {/* Pipeline */}
        <section className="pipeline-section">
          <h2>Pipeline предприятий</h2>
          <div className="pipeline-content">
            {(['A', 'B', 'V', 'G'] as const).map(cat => {
              const catEnterprises = enterprisesByCategory[cat]
              const maxScore = cat === 'A' ? 12 : cat === 'B' ? 18 : cat === 'V' ? 15 : 5
              return (
                <div key={cat} className={`category-block cat-${cat}`}>
                  <div className="category-header">
                    <span className="cat-badge">{cat === 'V' ? 'В' : cat === 'G' ? 'Г' : cat}</span>
                    <span className="cat-name">{getCategoryLabel(cat)}</span>
                    <span className="cat-count">{catEnterprises.length}/{maxScore}</span>
                  </div>
                  <div className="category-progress">
                    <div
                      className="category-progress-fill"
                      style={{ width: `${(catEnterprises.length / maxScore) * 100}%` }}
                    />
                  </div>
                  <ul className="enterprise-list">
                    {catEnterprises.slice(0, 3).map(ent => (
                      <li key={ent.id} className="enterprise-item">
                        <span className="ent-name">{ent.name}</span>
                        <span className="ent-score">[{ent.score} б.]</span>
                      </li>
                    ))}
                    {catEnterprises.length > 3 && (
                      <li className="more-link">+ ещё {catEnterprises.length - 3}</li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* Funnel */}
        <section className="funnel-section">
          <h2>Воронка продаж</h2>
          <div className="funnel-visual">
            <div className="funnel-stage" style={{ width: '100%' }}>
              <span className="stage-label">В планах</span>
              <span className="stage-count">{funnelStats.planned + funnelStats.contact + funnelStats.contract + funnelStats.launched}</span>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage" style={{ width: '75%' }}>
              <span className="stage-label">Первый контакт</span>
              <span className="stage-count">{funnelStats.contact + funnelStats.contract + funnelStats.launched}</span>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage" style={{ width: '50%' }}>
              <span className="stage-label">Договор</span>
              <span className="stage-count">{funnelStats.contract + funnelStats.launched}</span>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage launched" style={{ width: '25%' }}>
              <span className="stage-label">Запущено</span>
              <span className="stage-count">{funnelStats.launched}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Grid */}
      <div className="bottom-grid">
        {/* Risk Matrix */}
        <section className="risk-section">
          <h2>Матрица рисков</h2>
          <div className="risk-matrix">
            <div className="matrix-y-label">
              <span>Влияние</span>
            </div>
            <div className="matrix-grid">
              <div className="y-axis">
                <span>Крит.</span>
                <span>Высок.</span>
                <span>Средн.</span>
                <span>Низк.</span>
              </div>
              <div className="matrix-cells">
                {[4, 3, 2, 1].map(y => (
                  <div key={y} className="matrix-row">
                    {[1, 2, 3].map(x => {
                      const cellRisks = risks.filter(r => {
                        const pos = getRiskPosition(r.probability, r.impact)
                        return pos.x === x && pos.y === y
                      })
                      const severity = x + y > 5 ? 'high' : x + y > 3 ? 'medium' : 'low'
                      return (
                        <div
                          key={x}
                          className={`matrix-cell severity-${severity}`}
                        >
                          {cellRisks.map(r => (
                            <span
                              key={r.id}
                              className={`risk-badge severity-${severity}`}
                              title={`${r.title}\n\nМитигация: ${r.mitigation}`}
                            >
                              {r.id}
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="x-axis">
                <span>Низкая</span>
                <span>Средняя</span>
                <span>Высокая</span>
              </div>
            </div>
            <div className="matrix-x-label">Вероятность</div>
          </div>
          <div className="risk-list">
            {risks.map(r => {
              const pos = getRiskPosition(r.probability, r.impact)
              const severity = pos.x + pos.y > 5 ? 'high' : pos.x + pos.y > 3 ? 'medium' : 'low'
              return (
                <div key={r.id} className={`risk-list-item severity-${severity}`}>
                  <span className={`risk-num severity-${severity}`}>{r.id}</span>
                  <div className="risk-content">
                    <div className="risk-title">{r.title}</div>
                    <div className="risk-mitigation">{r.mitigation}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Milestones */}
        <section className="milestones-section">
          <h2>Ключевые вехи 2026</h2>
          <div className="milestones-list">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={`milestone-item status-${m.status}`}
              >
                <span className="milestone-icon">{getStatusIcon(m.status)}</span>
                <span className="milestone-month">{m.month}</span>
                <span className="milestone-title">{m.title}</span>
                {m.status === 'in_progress' && (
                  <span className="current-marker">← Сейчас</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Add/Edit Task Modal */}
      {showAddTask && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTask ? 'Редактировать задачу' : 'Добавить задачу'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Название задачи</label>
                <input
                  type="text"
                  placeholder="Введите название..."
                  value={newTask.title}
                  onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Трек</label>
                <select
                  value={newTask.track}
                  onChange={e => setNewTask(prev => ({ ...prev, track: e.target.value as 'internal' | 'external' | 'both' }))}
                >
                  <option value="internal">Трек 1: Сотрудники Банка</option>
                  <option value="external">Трек 2: Внешние клиенты</option>
                  <option value="both">Оба трека</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Начало</label>
                  <select
                    value={newTask.startQ}
                    onChange={e => setNewTask(prev => ({ ...prev, startQ: Number(e.target.value) }))}
                  >
                    <option value={1}>Q1 2026</option>
                    <option value={2}>Q2 2026</option>
                    <option value={3}>Q3 2026</option>
                    <option value={4}>Q4 2026</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Окончание</label>
                  <select
                    value={newTask.endQ}
                    onChange={e => setNewTask(prev => ({ ...prev, endQ: Number(e.target.value) }))}
                  >
                    <option value={1}>Q1 2026</option>
                    <option value={2}>Q2 2026</option>
                    <option value={3}>Q3 2026</option>
                    <option value={4}>Q4 2026</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Статус</label>
                <select
                  value={newTask.status}
                  onChange={e => setNewTask(prev => ({ ...prev, status: e.target.value as 'planned' | 'in_progress' | 'completed' }))}
                >
                  <option value="planned">Запланировано</option>
                  <option value="in_progress">В работе</option>
                  <option value="completed">Завершено</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseModal}>Отмена</button>
              <button
                className="btn-save"
                onClick={editingTask ? handleSaveEdit : handleAddTask}
                disabled={!newTask.title.trim()}
              >
                {editingTask ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchive && (
        <div className="modal-backdrop" onClick={() => setShowArchive(false)}>
          <div className="modal-box archive-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📁 Архив задач</h3>
              <button className="modal-close" onClick={() => setShowArchive(false)}>×</button>
            </div>
            <div className="modal-body">
              {archiveLoading ? (
                <div className="archive-loading">Загрузка...</div>
              ) : archivedTasks.length === 0 ? (
                <div className="archive-empty">
                  <p>Архив пуст</p>
                  <span>Архивированные задачи появятся здесь</span>
                </div>
              ) : (
                <div className="archive-list">
                  {archivedTasks.map(task => (
                    <div key={task.id} className="archive-item">
                      <div className="archive-item-info">
                        <span className="archive-item-title">{task.title}</span>
                        <span className="archive-item-meta">
                          Q{task.startQ}–Q{task.endQ} • {task.track === 'internal' ? 'Внутренний' : 'Внешний'}
                        </span>
                      </div>
                      <button
                        className="btn-restore"
                        onClick={() => handleRestoreTask(task)}
                        title="Восстановить"
                      >
                        ↩ Восстановить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <DashboardSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={() => loadDashboardData()}
      />

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">
              {confirmAction.type === 'delete' ? '🗑️' : '📁'}
            </div>
            <h3>
              {confirmAction.type === 'delete' ? 'Удалить задачу?' : 'Архивировать задачу?'}
            </h3>
            <p className="confirm-task-name">«{confirmAction.task.title}»</p>
            <p className="confirm-warning">
              {confirmAction.type === 'delete'
                ? 'Это действие нельзя отменить.'
                : 'Задача будет перемещена в архив.'}
            </p>
            <div className="confirm-buttons">
              <button className="btn-cancel" onClick={() => setConfirmAction(null)}>
                Отмена
              </button>
              <button
                className={`btn-confirm ${confirmAction.type}`}
                onClick={confirmAction.type === 'delete' ? handleDeleteTask : handleArchiveTask}
              >
                {confirmAction.type === 'delete' ? 'Удалить' : 'Архивировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dashboard-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Header */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .dashboard-header h1 {
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }
        .date-badge {
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 400;
        }
        .loading-indicator {
          font-size: 12px;
          color: var(--text-muted);
          padding: 4px 12px;
          background: #f0f0f0;
          border-radius: 12px;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .btn-settings {
          padding: 8px 16px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text);
          transition: all 0.2s;
        }
        .btn-settings:hover {
          background: #f0f0f0;
          border-color: var(--primary);
        }

        /* KPI Groups */
        .kpi-group {
          margin-bottom: 16px;
        }
        .kpi-group-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-muted);
          margin: 0 0 10px 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .kpi-group-zk .kpi-group-title {
          color: #6366f1;
        }

        /* KPI Section */
        .kpi-section {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .kpi-section-zk {
          grid-template-columns: repeat(2, 1fr);
          max-width: 50%;
        }
        .kpi-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .kpi-card.kpi-highlight {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 1px solid #fcd34d;
        }
        .kpi-icon {
          font-size: 24px;
          width: 48px;
          height: 48px;
          background: #f0f4ff;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kpi-content {
          flex: 1;
        }
        .kpi-label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .kpi-value {
          font-size: 24px;
          font-weight: 700;
          margin: 4px 0;
        }
        .kpi-value .current {
          color: var(--primary);
        }
        .kpi-value .separator {
          color: #ccc;
          margin: 0 2px;
        }
        .kpi-value .target {
          color: var(--text-muted);
          font-weight: 400;
        }
        .kpi-unit {
          font-size: 11px;
          color: var(--text-muted);
        }
        .kpi-date {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px dashed #e5e7eb;
          text-align: left;
        }
        .kpi-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .kpi-bar {
          flex: 1;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }
        .kpi-bar-fill {
          height: 100%;
          background: var(--primary);
          border-radius: 2px;
          transition: width 0.3s;
        }
        .kpi-percent {
          font-size: 12px;
          font-weight: 600;
          color: var(--primary);
          min-width: 36px;
          text-align: right;
        }

        /* Track Tabs */
        .track-tabs {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .tabs-group {
          display: flex;
          gap: 8px;
        }
        .track-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: 1px solid var(--border);
          background: white;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .track-tab:hover {
          border-color: var(--primary);
        }
        .track-tab.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .tab-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .tab-dot.internal { background: #22c55e; }
        .tab-dot.external { background: #3b82f6; }
        .track-tab.active .tab-dot {
          background: white;
        }
        .btn-add-task {
          padding: 8px 16px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-add-task:hover {
          opacity: 0.9;
        }

        /* Timeline */
        .timeline-section {
          background: white;
          border-radius: 12px;
          padding: 14px 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .timeline-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .timeline-header-row h2 {
          font-size: 14px;
          margin: 0;
        }
        .timeline-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .btn-archive-link {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .btn-archive-link:hover {
          background: #e8e8e8;
          color: var(--text);
        }
        .timeline-legend {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .legend-group {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
        }
        .legend-title {
          color: var(--text-muted);
          font-weight: 600;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 3px;
          color: var(--text-muted);
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }
        .legend-dot.status-completed { background: #22c55e; }
        .legend-dot.status-in_progress { background: #f59e0b; }
        .legend-dot.status-planned { background: #94a3b8; }
        .legend-bar {
          width: 16px;
          height: 8px;
          border-radius: 2px;
          border: 1px solid;
        }
        .legend-bar.track-internal {
          background: #22c55e;
          border-color: #16a34a;
        }
        .legend-bar.track-external {
          background: #3b82f6;
          border-color: #2563eb;
        }
        .legend-bar.track-both {
          background: linear-gradient(135deg, #22c55e 50%, #3b82f6 50%);
          border-color: transparent;
        }
        .timeline-section h2 {
          font-size: 16px;
          margin: 0 0 16px;
        }
        .timeline-grid {
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .timeline-header {
          display: flex;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 4px;
        }
        .timeline-label {
          width: 220px;
          flex-shrink: 0;
          font-size: 11px;
          color: var(--text-muted);
          white-space: normal;
          word-break: normal;
          overflow-wrap: normal;
          padding-right: 12px;
          line-height: 1.3;
        }
        .quarter-col {
          flex: 1;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .timeline-row {
          display: flex;
          align-items: flex-start;
          padding: 4px 0;
          min-height: 22px;
        }
        .timeline-row:hover {
          background: #f8f9fa;
        }
        .timeline-row .timeline-label {
          font-size: 11px;
          color: var(--text);
        }
        .timeline-bars {
          flex: 1;
          position: relative;
          height: 18px;
          background:
            linear-gradient(90deg, transparent 24.9%, #f0f0f0 25%, #f0f0f0 25.1%, transparent 25.2%),
            linear-gradient(90deg, transparent 49.9%, #f0f0f0 50%, #f0f0f0 50.1%, transparent 50.2%),
            linear-gradient(90deg, transparent 74.9%, #f0f0f0 75%, #f0f0f0 75.1%, transparent 75.2%);
        }
        .task-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
          padding-left: 8px;
        }
        .timeline-row:hover .task-actions {
          opacity: 1;
        }
        .action-btn {
          width: 22px;
          height: 22px;
          border: none;
          background: #f0f0f0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .action-btn:hover {
          transform: scale(1.1);
        }
        .action-btn.edit:hover {
          background: #dbeafe;
          color: #2563eb;
        }
        .action-btn.archive:hover {
          background: #fef3c7;
          color: #d97706;
        }
        .action-btn.delete:hover {
          background: #fee2e2;
          color: #dc2626;
        }
        .timeline-bar {
          position: absolute;
          height: 14px;
          top: 2px;
          border-radius: 3px;
          z-index: 2;
        }
        .timeline-bar.status-completed { background: #22c55e; }
        .timeline-bar.status-in_progress { background: #f59e0b; }
        .timeline-bar.status-planned { background: #94a3b8; }
        .timeline-bar.track-internal { border: 2px solid #16a34a; }
        .timeline-bar.track-external { border: 2px solid #2563eb; }
        .timeline-bar.track-both {
          background: linear-gradient(135deg, #22c55e 50%, #3b82f6 50%);
        }

        /* Current date line */
        .current-date-line-container {
          display: flex;
          position: absolute;
          top: 35px;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 1;
        }
        .current-date-line-container > .timeline-label {
          width: 220px;
          flex-shrink: 0;
          padding-right: 12px;
        }
        .current-date-line-wrapper {
          flex: 1;
          position: relative;
        }
        .current-date-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1.5px;
          background: #dc2626;
          transform: translateX(-50%);
          pointer-events: auto;
          cursor: help;
        }
        .current-date-label {
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(-50%);
          background: #dc2626;
          color: white;
          font-size: 9px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
          white-space: nowrap;
          z-index: 10;
        }

        /* Main Grid */
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        /* Pipeline */
        .pipeline-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .pipeline-section h2 {
          font-size: 16px;
          margin: 0 0 16px;
        }
        .pipeline-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .category-block {
          border-left: 4px solid;
          padding-left: 12px;
        }
        .category-block.cat-A { border-color: #22c55e; }
        .category-block.cat-B { border-color: #3b82f6; }
        .category-block.cat-V { border-color: #f59e0b; }
        .category-block.cat-G { border-color: #ef4444; }
        .category-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .cat-badge {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: white;
        }
        .cat-A .cat-badge { background: #22c55e; }
        .cat-B .cat-badge { background: #3b82f6; }
        .cat-V .cat-badge { background: #f59e0b; }
        .cat-G .cat-badge { background: #ef4444; }
        .cat-name {
          font-size: 13px;
          font-weight: 500;
          flex: 1;
        }
        .cat-count {
          font-size: 12px;
          color: var(--text-muted);
        }
        .category-progress {
          height: 3px;
          background: #e5e7eb;
          border-radius: 2px;
          margin-bottom: 8px;
          overflow: hidden;
        }
        .category-progress-fill {
          height: 100%;
          border-radius: 2px;
        }
        .cat-A .category-progress-fill { background: #22c55e; }
        .cat-B .category-progress-fill { background: #3b82f6; }
        .cat-V .category-progress-fill { background: #f59e0b; }
        .cat-G .category-progress-fill { background: #ef4444; }
        .enterprise-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .enterprise-item {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          padding: 3px 0;
          color: var(--text-muted);
        }
        .ent-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ent-score {
          color: #999;
          flex-shrink: 0;
          margin-left: 8px;
        }
        .more-link {
          font-size: 11px;
          color: var(--primary);
          cursor: pointer;
        }

        /* Funnel */
        .funnel-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .funnel-section h2 {
          font-size: 16px;
          margin: 0 0 16px;
        }
        .funnel-visual {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .funnel-stage {
          background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
          border-radius: 6px;
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .funnel-stage.launched {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
        }
        .stage-label {
          font-size: 13px;
          font-weight: 500;
        }
        .stage-count {
          font-size: 18px;
          font-weight: 700;
        }
        .funnel-connector {
          width: 2px;
          height: 8px;
          background: #c7d2fe;
        }

        /* Bottom Grid */
        .bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        /* Risk Matrix */
        .risk-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .risk-section h2 {
          font-size: 16px;
          margin: 0 0 16px;
        }
        .risk-matrix {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .matrix-y-label {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .matrix-grid {
          display: flex;
          gap: 4px;
        }
        .y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          font-size: 10px;
          color: var(--text-muted);
          text-align: right;
          padding-right: 8px;
        }
        .matrix-cells {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .matrix-row {
          display: flex;
          gap: 2px;
        }
        .matrix-cell {
          width: 60px;
          height: 40px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 14px;
        }
        .matrix-cell.severity-low { background: #d1fae5; }
        .matrix-cell.severity-medium { background: #fef3c7; }
        .matrix-cell.severity-high { background: #fecaca; }
        .risk-badge {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          cursor: help;
          color: white;
        }
        .risk-badge.severity-high { background: #dc2626; }
        .risk-badge.severity-medium { background: #d97706; }
        .risk-badge.severity-low { background: #059669; }
        .x-axis {
          display: flex;
          justify-content: space-around;
          width: 100%;
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 8px;
        }
        .matrix-x-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 8px;
        }
        .risk-list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .risk-list-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 6px;
          border-radius: 4px;
          background: #f8f9fa;
        }
        .risk-list-item.severity-high { border-left: 2px solid #dc2626; }
        .risk-list-item.severity-medium { border-left: 2px solid #d97706; }
        .risk-list-item.severity-low { border-left: 2px solid #059669; }
        .risk-num {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        .risk-num.severity-high { background: #dc2626; }
        .risk-num.severity-medium { background: #d97706; }
        .risk-num.severity-low { background: #059669; }
        .risk-content {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .risk-title {
          font-size: 11px;
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
        }
        .risk-mitigation {
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Milestones */
        .milestones-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .milestones-section h2 {
          font-size: 16px;
          margin: 0 0 16px;
        }
        .milestones-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .milestone-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
        }
        .milestone-item.status-completed {
          background: #f0fdf4;
          color: #16a34a;
        }
        .milestone-item.status-in_progress {
          background: #fffbeb;
          color: #d97706;
        }
        .milestone-item.status-planned {
          background: #f8fafc;
          color: var(--text-muted);
        }
        .milestone-icon {
          font-size: 14px;
        }
        .milestone-month {
          width: 32px;
          font-weight: 600;
        }
        .milestone-title {
          flex: 1;
        }
        .current-marker {
          font-size: 11px;
          color: #d97706;
          font-weight: 600;
        }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-box {
          background: white;
          border-radius: 12px;
          width: 480px;
          max-height: 80vh;
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .modal-header h3 {
          margin: 0;
          font-size: 16px;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-muted);
        }
        .modal-body {
          padding: 20px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 14px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--border);
        }
        .btn-cancel {
          padding: 8px 16px;
          border: 1px solid var(--border);
          background: white;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-save {
          padding: 8px 16px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Confirmation Dialog */
        .confirm-dialog {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 360px;
          text-align: center;
        }
        .confirm-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .confirm-dialog h3 {
          margin: 0 0 8px;
          font-size: 18px;
        }
        .confirm-task-name {
          font-weight: 500;
          color: var(--text);
          margin: 0 0 8px;
        }
        .confirm-warning {
          font-size: 13px;
          color: var(--text-muted);
          margin: 0 0 20px;
        }
        .confirm-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .btn-confirm {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-confirm.delete {
          background: #dc2626;
          color: white;
        }
        .btn-confirm.delete:hover {
          background: #b91c1c;
        }
        .btn-confirm.archive {
          background: #d97706;
          color: white;
        }
        .btn-confirm.archive:hover {
          background: #b45309;
        }

        /* Archive Modal */
        .archive-modal {
          width: 500px;
          max-height: 70vh;
        }
        .archive-modal .modal-body {
          max-height: 50vh;
          overflow-y: auto;
        }
        .archive-loading, .archive-empty {
          text-align: center;
          padding: 32px;
          color: var(--text-muted);
        }
        .archive-empty span {
          font-size: 12px;
          display: block;
          margin-top: 4px;
        }
        .archive-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .archive-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 3px solid #94a3b8;
        }
        .archive-item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .archive-item-title {
          font-size: 13px;
          font-weight: 500;
        }
        .archive-item-meta {
          font-size: 11px;
          color: var(--text-muted);
        }
        .btn-restore {
          background: white;
          border: 1px solid var(--primary);
          color: var(--primary);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-restore:hover {
          background: var(--primary);
          color: white;
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .kpi-section {
            grid-template-columns: repeat(2, 1fr);
          }
          .kpi-section-zk {
            max-width: 100%;
          }
        }
        @media (max-width: 900px) {
          .main-grid,
          .bottom-grid {
            grid-template-columns: 1fr;
          }
          .track-tabs {
            flex-direction: column;
            gap: 12px;
          }
          .tabs-group {
            flex-wrap: wrap;
          }
        }
        @media (max-width: 600px) {
          .kpi-section {
            grid-template-columns: 1fr;
          }
          .timeline-label {
            width: 120px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  )
}

export default Dashboard
