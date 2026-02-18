import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface RoadmapItem {
  id: number
  title: string
  description: string
  track: 'internal_pilot' | 'external_clients'
  status: string
  quarter: string
  year: number
  responsible: string
}

function Roadmap() {
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTrack, setActiveTrack] = useState<string>('all')

  useEffect(() => {
    loadRoadmap()
  }, [])

  const loadRoadmap = async () => {
    try {
      const response = await api.get('/roadmap')
      setItems(response.data)
    } catch (error) {
      console.error('Failed to load roadmap:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = activeTrack === 'all'
    ? items
    : items.filter(i => i.track === activeTrack)

  const groupByQuarter = (items: RoadmapItem[]) => {
    const grouped: Record<string, RoadmapItem[]> = {}
    items.forEach(item => {
      const key = `${item.quarter} ${item.year}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    })
    return grouped
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: '#e2e8f0',
      in_progress: '#fef3c7',
      completed: '#d1fae5',
      blocked: '#fecaca',
    }
    return colors[status] || '#e2e8f0'
  }

  if (loading) return <div>Loading...</div>

  const grouped = groupByQuarter(filteredItems)

  return (
    <div className="roadmap">
      <div className="page-header">
        <h2>Дорожная карта 2026-2027</h2>
        <div className="track-filter">
          <button
            className={`filter-btn ${activeTrack === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTrack('all')}
          >
            Все
          </button>
          <button
            className={`filter-btn ${activeTrack === 'internal_pilot' ? 'active' : ''}`}
            onClick={() => setActiveTrack('internal_pilot')}
          >
            Пилот (банк)
          </button>
          <button
            className={`filter-btn ${activeTrack === 'external_clients' ? 'active' : ''}`}
            onClick={() => setActiveTrack('external_clients')}
          >
            Внешние клиенты
          </button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Дорожная карта пуста. Добавьте элементы через API или интерфейс.</p>
        </div>
      ) : (
        <div className="timeline">
          {Object.entries(grouped).map(([quarter, quarterItems]) => (
            <div key={quarter} className="quarter-section">
              <h3 className="quarter-title">{quarter}</h3>
              <div className="quarter-items">
                {quarterItems.map(item => (
                  <div
                    key={item.id}
                    className="roadmap-item card"
                    style={{ borderLeftColor: getStatusColor(item.status) }}
                  >
                    <div className="item-header">
                      <span className="item-track">
                        {item.track === 'internal_pilot' ? 'Пилот' : 'Внешние'}
                      </span>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status}
                      </span>
                    </div>
                    <h4>{item.title}</h4>
                    {item.description && <p>{item.description}</p>}
                    {item.responsible && (
                      <div className="item-responsible">Ответственный: {item.responsible}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .track-filter {
          display: flex;
          gap: 0.5rem;
        }
        .filter-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border);
          background: white;
          border-radius: 6px;
          font-size: 0.875rem;
        }
        .filter-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .quarter-section {
          margin-bottom: 2rem;
        }
        .quarter-title {
          color: var(--primary);
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid var(--primary);
        }
        .quarter-items {
          display: grid;
          gap: 1rem;
        }
        .roadmap-item {
          border-left: 4px solid;
        }
        .item-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .item-track {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .roadmap-item h4 {
          margin-bottom: 0.25rem;
        }
        .roadmap-item p {
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .item-responsible {
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}

export default Roadmap
