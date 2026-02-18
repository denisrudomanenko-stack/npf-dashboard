import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

interface Stats {
  enterprises: { total: number; active: number; pilot: number }
  roadmap: { total: number; in_progress: number; completed: number }
  documents: { total: number; chunks: number }
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [enterprises, roadmap, ragStats] = await Promise.all([
        api.get('/enterprises'),
        api.get('/roadmap'),
        api.get('/rag/stats'),
      ])

      const enterpriseData = enterprises.data
      const roadmapData = roadmap.data

      setStats({
        enterprises: {
          total: enterpriseData.length,
          active: enterpriseData.filter((e: any) => e.status === 'active').length,
          pilot: enterpriseData.filter((e: any) => e.status === 'pilot').length,
        },
        roadmap: {
          total: roadmapData.length,
          in_progress: roadmapData.filter((r: any) => r.status === 'in_progress').length,
          completed: roadmapData.filter((r: any) => r.status === 'completed').length,
        },
        documents: {
          total: 0,
          chunks: ragStats.data.total_chunks,
        },
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Развитие корпоративного блока НПФ
      </p>

      <div className="stats-grid">
        <div className="card stat-card">
          <h3>Предприятия</h3>
          <div className="stat-value">{stats?.enterprises.total || 0}</div>
          <div className="stat-details">
            <span>Активных: {stats?.enterprises.active || 0}</span>
            <span>Пилот: {stats?.enterprises.pilot || 0}</span>
          </div>
          <Link to="/enterprises" className="card-link">Перейти →</Link>
        </div>

        <div className="card stat-card">
          <h3>Дорожная карта</h3>
          <div className="stat-value">{stats?.roadmap.total || 0}</div>
          <div className="stat-details">
            <span>В работе: {stats?.roadmap.in_progress || 0}</span>
            <span>Завершено: {stats?.roadmap.completed || 0}</span>
          </div>
          <Link to="/roadmap" className="card-link">Перейти →</Link>
        </div>

        <div className="card stat-card">
          <h3>База знаний (RAG)</h3>
          <div className="stat-value">{stats?.documents.chunks || 0}</div>
          <div className="stat-details">
            <span>Фрагментов в индексе</span>
          </div>
          <Link to="/documents" className="card-link">Перейти →</Link>
        </div>
      </div>

      <div className="tracks-section">
        <h3>Треки развития</h3>
        <div className="tracks-grid">
          <div className="card track-card">
            <h4>Трек 1: Пилот на сотрудниках банка</h4>
            <p>Отработка процессов и материалов на внутренней аудитории</p>
          </div>
          <div className="card track-card">
            <h4>Трек 2: Внешние корпклиенты</h4>
            <p>Предприятия отрасли — продажи КПП через корпблок</p>
          </div>
        </div>
      </div>

      <style>{`
        .dashboard h2 {
          margin-bottom: 0.5rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .stat-card h3 {
          color: var(--text-muted);
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }
        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--primary);
        }
        .stat-details {
          display: flex;
          gap: 1rem;
          color: var(--text-muted);
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }
        .card-link {
          display: inline-block;
          margin-top: 1rem;
          font-size: 0.875rem;
          color: var(--primary);
        }
        .tracks-section h3 {
          margin-bottom: 1rem;
        }
        .tracks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }
        .track-card h4 {
          margin-bottom: 0.5rem;
          color: var(--primary);
        }
        .track-card p {
          color: var(--text-muted);
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  )
}

export default Dashboard
