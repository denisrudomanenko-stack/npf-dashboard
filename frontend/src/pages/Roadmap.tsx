import { useState } from 'react'
import { usePermissions } from '../hooks/usePermissions'

// Format number with space separators (Russian locale)
function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value).replace(/\u00A0/g, ' ')
}

// Types
interface KPIData {
  collections: { current: number; target: number }
  participants: { current: number; target: number }
  enterprises: { inProgress: number; total: number }
  progress: number
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
  status: 'contact' | 'presentation' | 'negotiation' | 'contract' | 'launched'
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

// Mock data based on the analytical document
const kpiData: KPIData = {
  collections: { current: 0.8, target: 3.0 },
  participants: { current: 2800, target: 4500 },
  enterprises: { inProgress: 12, total: 50 },
  progress: 27
}

const timelineTasks: TimelineTask[] = [
  { id: '1', title: 'Юридический аудит целевого списка', startQ: 1, endQ: 1, track: 'external', status: 'completed' },
  { id: '2', title: 'Скоринг и приоритизация пула', startQ: 1, endQ: 2, track: 'external', status: 'in_progress' },
  { id: '3', title: 'Согласование модели с корпблоком', startQ: 1, endQ: 1, track: 'both', status: 'completed' },
  { id: '4', title: 'Переговоры категория А', startQ: 1, endQ: 3, track: 'external', status: 'in_progress' },
  { id: '5', title: 'Пилотные подключения', startQ: 2, endQ: 3, track: 'external', status: 'planned' },
  { id: '6', title: 'Категория Б — расширение воронки', startQ: 2, endQ: 4, track: 'external', status: 'planned' },
  { id: '7', title: 'Целевые кампании сотрудники Банка', startQ: 1, endQ: 3, track: 'internal', status: 'in_progress' },
  { id: '8', title: 'Масштабирование программы Банка', startQ: 3, endQ: 4, track: 'internal', status: 'planned' },
  { id: '9', title: 'Индустриализация процесса', startQ: 3, endQ: 4, track: 'both', status: 'planned' },
]

const enterprises: Enterprise[] = [
  { id: 1, name: 'ПАО "НПО Энергомаш"', score: 112, category: 'A', status: 'negotiation' },
  { id: 2, name: 'АО "РКК Энергия"', score: 108, category: 'A', status: 'presentation' },
  { id: 3, name: 'АО "ИСС Решетнёва"', score: 105, category: 'A', status: 'contract' },
  { id: 4, name: 'ФГУП "ЦЭНКИ"', score: 98, category: 'A', status: 'contact' },
  { id: 5, name: 'АО "ГКНПЦ Хруничева"', score: 95, category: 'B', status: 'presentation' },
  { id: 6, name: 'АО "Композит"', score: 88, category: 'B', status: 'contact' },
  { id: 7, name: 'ФГУП "НПО Техномаш"', score: 82, category: 'B', status: 'contact' },
  { id: 8, name: 'АО "НИИ ТП"', score: 78, category: 'B', status: 'presentation' },
  { id: 9, name: 'АО "НПО Лавочкина"', score: 72, category: 'V', status: 'contact' },
  { id: 10, name: 'ФГУП "ЦНИИмаш"', score: 68, category: 'V', status: 'contact' },
  { id: 11, name: 'АО "Российские космические системы"', score: 65, category: 'V', status: 'contact' },
  { id: 12, name: 'ФГУП "НПЦАП"', score: 45, category: 'G', status: 'contact' },
]

const risks: Risk[] = [
  { id: '1', title: 'Длинный цикл сделок', probability: 'high', impact: 'critical', mitigation: 'Front-loading переговоров в Q1' },
  { id: '2', title: 'Вовлечённость корпблока', probability: 'high', impact: 'critical', mitigation: 'Включение КПП в KPI менеджеров' },
  { id: '3', title: 'Нормативные блокеры', probability: 'medium', impact: 'high', mitigation: 'Юридический аудит до продаж' },
  { id: '4', title: 'Низкая конверсия сотрудников', probability: 'medium', impact: 'high', mitigation: 'Сегментация, калькулятор выгоды' },
  { id: '5', title: 'Бюджетный цикл', probability: 'high', impact: 'medium', mitigation: 'Раннее выявление, работа на 2027' },
  { id: '6', title: 'Режимные ограничения', probability: 'medium', impact: 'medium', mitigation: 'Работа через внутренних агентов' },
  { id: '7', title: 'Текучка персонала', probability: 'medium', impact: 'medium', mitigation: 'Механизм vesting' },
]

const milestones: Milestone[] = [
  { id: '1', month: 'Янв', title: 'Согласование модели с корпблоком', status: 'completed' },
  { id: '2', month: 'Фев', title: 'Юридический аудит завершён', status: 'completed' },
  { id: '3', month: 'Мар', title: 'Скоринг-матрица заполнена', status: 'in_progress' },
  { id: '4', month: 'Апр', title: 'Первые 3 договора категории А', status: 'planned' },
  { id: '5', month: 'Июн', title: 'Запуск первого потока взносов', status: 'planned' },
  { id: '6', month: 'Сен', title: '15 активных предприятий', status: 'planned' },
  { id: '7', month: 'Дек', title: 'Выполнение плана 3 млрд', status: 'planned' },
]

function Roadmap() {
  const { canEdit } = usePermissions()
  const [activeTrack, setActiveTrack] = useState<'all' | 'internal' | 'external'>('all')
  const [showAddTask, setShowAddTask] = useState(false)

  // Filter timeline by track
  const filteredTasks = activeTrack === 'all'
    ? timelineTasks
    : timelineTasks.filter(t => t.track === activeTrack || t.track === 'both')

  // Group enterprises by category
  const enterprisesByCategory = {
    A: enterprises.filter(e => e.category === 'A'),
    B: enterprises.filter(e => e.category === 'B'),
    V: enterprises.filter(e => e.category === 'V'),
    G: enterprises.filter(e => e.category === 'G'),
  }

  // Calculate funnel stats
  const funnelStats = {
    contact: enterprises.filter(e => e.status === 'contact').length,
    presentation: enterprises.filter(e => e.status === 'presentation').length,
    negotiation: enterprises.filter(e => e.status === 'negotiation').length,
    contract: enterprises.filter(e => e.status === 'contract').length,
    launched: enterprises.filter(e => e.status === 'launched').length,
  }

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

  return (
    <div className="roadmap-page">
      {/* Header */}
      <header className="roadmap-header">
        <div className="header-left">
          <h1>Дорожная карта развития</h1>
          <span className="year-badge">2026</span>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="kpi-section">
        <div className="kpi-card">
          <div className="kpi-icon">📊</div>
          <div className="kpi-content">
            <div className="kpi-label">Сборы КПП</div>
            <div className="kpi-value">
              <span className="current">{kpiData.collections.current}</span>
              <span className="separator">/</span>
              <span className="target">{kpiData.collections.target}</span>
            </div>
            <div className="kpi-unit">млрд руб</div>
            <div className="kpi-bar">
              <div
                className="kpi-bar-fill"
                style={{ width: `${(kpiData.collections.current / kpiData.collections.target) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">👥</div>
          <div className="kpi-content">
            <div className="kpi-label">Участники Банка</div>
            <div className="kpi-value">
              <span className="current">{formatNumber(kpiData.participants.current)}</span>
              <span className="separator">/</span>
              <span className="target">{formatNumber(kpiData.participants.target)}</span>
            </div>
            <div className="kpi-unit">человек</div>
            <div className="kpi-bar">
              <div
                className="kpi-bar-fill"
                style={{ width: `${(kpiData.participants.current / kpiData.participants.target) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">🏢</div>
          <div className="kpi-content">
            <div className="kpi-label">Предприятий</div>
            <div className="kpi-value">
              <span className="current">{kpiData.enterprises.inProgress}</span>
              <span className="separator">/</span>
              <span className="target">{kpiData.enterprises.total}</span>
            </div>
            <div className="kpi-unit">в работе</div>
            <div className="kpi-bar">
              <div
                className="kpi-bar-fill"
                style={{ width: `${(kpiData.enterprises.inProgress / kpiData.enterprises.total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">📈</div>
          <div className="kpi-content">
            <div className="kpi-label">Прогресс плана</div>
            <div className="kpi-value">
              <span className="current">{kpiData.progress}</span>
              <span className="target">%</span>
            </div>
            <div className="kpi-unit">выполнено</div>
            <div className="kpi-bar">
              <div className="kpi-bar-fill" style={{ width: `${kpiData.progress}%` }} />
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
        {canEdit && (
          <button className="btn-add-task" onClick={() => setShowAddTask(true)}>
            + Задача
          </button>
        )}
      </section>

      {/* Timeline */}
      <section className="timeline-section">
        <h2>Временная шкала</h2>
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
            </div>
          ))}
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
              <span className="stage-label">Первый контакт</span>
              <span className="stage-count">{funnelStats.contact + funnelStats.presentation + funnelStats.negotiation + funnelStats.contract + funnelStats.launched}</span>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage" style={{ width: '75%' }}>
              <span className="stage-label">Презентация</span>
              <span className="stage-count">{funnelStats.presentation + funnelStats.negotiation + funnelStats.contract + funnelStats.launched}</span>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage" style={{ width: '50%' }}>
              <span className="stage-label">Переговоры</span>
              <span className="stage-count">{funnelStats.negotiation + funnelStats.contract + funnelStats.launched}</span>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage" style={{ width: '35%' }}>
              <span className="stage-label">Договор</span>
              <span className="stage-count">{funnelStats.contract + funnelStats.launched}</span>
            </div>
            <div className="funnel-connector"></div>
            <div className="funnel-stage launched" style={{ width: '20%' }}>
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
                      return (
                        <div
                          key={x}
                          className={`matrix-cell severity-${x + y > 5 ? 'high' : x + y > 3 ? 'medium' : 'low'}`}
                        >
                          {cellRisks.map(r => (
                            <span
                              key={r.id}
                              className="risk-dot"
                              title={`${r.title}\n\nМитигация: ${r.mitigation}`}
                            >
                              {x + y > 4 ? '⚠️' : '○'}
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
          <div className="risk-legend">
            {risks.slice(0, 4).map(r => (
              <div key={r.id} className="risk-item" title={r.mitigation}>
                <span className={`risk-indicator prob-${r.probability}`}>
                  {getRiskPosition(r.probability, r.impact).x + getRiskPosition(r.probability, r.impact).y > 4 ? '⚠️' : '○'}
                </span>
                <span className="risk-title">{r.title}</span>
              </div>
            ))}
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

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="modal-backdrop" onClick={() => setShowAddTask(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Добавить задачу</h3>
              <button className="modal-close" onClick={() => setShowAddTask(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Название задачи</label>
                <input type="text" placeholder="Введите название..." />
              </div>
              <div className="form-group">
                <label>Трек</label>
                <select>
                  <option value="internal">Трек 1: Сотрудники Банка</option>
                  <option value="external">Трек 2: Внешние клиенты</option>
                  <option value="both">Оба трека</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Начало</label>
                  <select>
                    <option>Q1 2026</option>
                    <option>Q2 2026</option>
                    <option>Q3 2026</option>
                    <option>Q4 2026</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Окончание</label>
                  <select>
                    <option>Q1 2026</option>
                    <option>Q2 2026</option>
                    <option>Q3 2026</option>
                    <option>Q4 2026</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea placeholder="Опишите задачу..." rows={3}></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddTask(false)}>Отмена</button>
              <button className="btn-save" onClick={() => setShowAddTask(false)}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .roadmap-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Header */
        .roadmap-header {
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
        .roadmap-header h1 {
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }
        .year-badge {
          background: var(--primary);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        /* KPI Section */
        .kpi-section {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .kpi-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
        .kpi-bar {
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
        }
        .kpi-bar-fill {
          height: 100%;
          background: var(--primary);
          border-radius: 2px;
          transition: width 0.3s;
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
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .timeline-section h2 {
          font-size: 16px;
          margin: 0 0 16px;
        }
        .timeline-grid {
          display: flex;
          flex-direction: column;
        }
        .timeline-header {
          display: flex;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 8px;
        }
        .timeline-label {
          width: 250px;
          flex-shrink: 0;
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding-right: 16px;
        }
        .quarter-col {
          flex: 1;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .timeline-row {
          display: flex;
          align-items: center;
          padding: 6px 0;
        }
        .timeline-row .timeline-label {
          font-size: 13px;
          color: var(--text);
        }
        .timeline-bars {
          flex: 1;
          position: relative;
          height: 24px;
          background:
            linear-gradient(90deg, transparent 24.9%, #f0f0f0 25%, #f0f0f0 25.1%, transparent 25.2%),
            linear-gradient(90deg, transparent 49.9%, #f0f0f0 50%, #f0f0f0 50.1%, transparent 50.2%),
            linear-gradient(90deg, transparent 74.9%, #f0f0f0 75%, #f0f0f0 75.1%, transparent 75.2%);
        }
        .timeline-bar {
          position: absolute;
          height: 20px;
          top: 2px;
          border-radius: 4px;
        }
        .timeline-bar.status-completed { background: #22c55e; }
        .timeline-bar.status-in_progress { background: #f59e0b; }
        .timeline-bar.status-planned { background: #94a3b8; }
        .timeline-bar.track-internal { border: 2px solid #16a34a; }
        .timeline-bar.track-external { border: 2px solid #2563eb; }
        .timeline-bar.track-both {
          background: linear-gradient(135deg, #22c55e 50%, #3b82f6 50%);
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
        .risk-dot {
          cursor: help;
        }
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
        .risk-legend {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .risk-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          cursor: help;
        }
        .risk-indicator {
          font-size: 12px;
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

        /* Responsive */
        @media (max-width: 1200px) {
          .kpi-section {
            grid-template-columns: repeat(2, 1fr);
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

export default Roadmap
