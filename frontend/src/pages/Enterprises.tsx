import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface Enterprise {
  id: number
  name: string
  industry: string
  employee_count: number
  bank_penetration: number
  status: string
  locations: string
}

function Enterprises() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    loadEnterprises()
  }, [])

  const loadEnterprises = async () => {
    try {
      const response = await api.get('/enterprises')
      setEnterprises(response.data)
    } catch (error) {
      console.error('Failed to load enterprises:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post('/enterprises/import', formData)
      loadEnterprises()
      setShowImport(false)
    } catch (error) {
      console.error('Import failed:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      prospect: 'Потенциал',
      negotiation: 'Переговоры',
      pilot: 'Пилот',
      active: 'Активный',
    }
    return <span className={`status-badge status-${status}`}>{labels[status] || status}</span>
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="enterprises">
      <div className="page-header">
        <h2>Предприятия</h2>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setShowImport(!showImport)}>
            Импорт Excel
          </button>
        </div>
      </div>

      {showImport && (
        <div className="card import-card">
          <h4>Импорт из файла</h4>
          <p>Поддерживаются форматы: .xlsx, .xls, .csv</p>
          <p>Ожидаемые колонки: name/Наименование, industry/Отрасль, employee_count/Численность, bank_penetration/Проникновение ЗП</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} />
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Наименование</th>
              <th>Отрасль</th>
              <th>Численность</th>
              <th>Проникновение ЗП</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {enterprises.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Нет данных. Импортируйте файл с предприятиями.
                </td>
              </tr>
            ) : (
              enterprises.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong></td>
                  <td>{e.industry}</td>
                  <td>{e.employee_count?.toLocaleString()}</td>
                  <td>{e.bank_penetration ? `${e.bank_penetration}%` : '-'}</td>
                  <td>{getStatusBadge(e.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .import-card {
          margin-bottom: 1rem;
        }
        .import-card h4 {
          margin-bottom: 0.5rem;
        }
        .import-card p {
          color: var(--text-muted);
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }
        .import-card input {
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  )
}

export default Enterprises
