import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { usePermissions } from '../hooks/usePermissions'
import { useNavigate } from 'react-router-dom'

interface RAGDocument {
  id: number
  title: string
  original_filename: string
  file_type: string
  file_size: number
  document_type: string
  rag_status: string
  created_at: string
  created_by_id: number | null
}

interface RAGStats {
  pending: number
  indexed: number
  rejected: number
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  indexed: 'В RAG',
  rejected: 'Отклонён',
  not_for_rag: 'Не для RAG'
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  indexed: '#10b981',
  rejected: '#ef4444',
  not_for_rag: '#6b7280'
}

export default function RAGQueue() {
  const { isAdmin } = usePermissions()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [stats, setStats] = useState<RAGStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    loadData()
  }, [isAdmin, filter])

  const loadData = async () => {
    try {
      setLoading(true)
      const [statsRes, docsRes] = await Promise.all([
        api.get('/documents/rag-queue/stats'),
        api.get(`/documents/rag-queue/list?status=${filter}`)
      ])
      setStats(statsRes.data)
      setDocuments(docsRes.data)
    } catch (error) {
      console.error('Failed to load RAG queue:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (docId: number, newStatus: string) => {
    try {
      await api.patch(`/documents/${docId}/rag-status`, { status: newStatus })
      loadData()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const markSelectedAsIndexed = async () => {
    if (selected.size === 0) return
    try {
      setProcessing(true)
      await api.post('/documents/rag-queue/mark-indexed', Array.from(selected))
      setSelected(new Set())
      loadData()
    } catch (error) {
      console.error('Failed to mark as indexed:', error)
    } finally {
      setProcessing(false)
    }
  }

  const downloadPending = async () => {
    try {
      setProcessing(true)
      const response = await api.get('/documents/rag-queue/download', {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'rag_pending_documents.zip')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      if (error.response?.status === 404) {
        alert('Нет документов для скачивания')
      } else {
        console.error('Failed to download:', error)
      }
    } finally {
      setProcessing(false)
    }
  }

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const selectAll = () => {
    if (selected.size === documents.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(documents.map(d => d.id)))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isAdmin) return null

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Очередь RAG</h1>
        <p style={styles.subtitle}>Управление документами для базы знаний Timeweb</p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={styles.statsRow}>
          <div
            style={{
              ...styles.statCard,
              borderColor: filter === 'pending' ? STATUS_COLORS.pending : '#e5e7eb'
            }}
            onClick={() => setFilter('pending')}
          >
            <div style={styles.statValue}>{stats.pending}</div>
            <div style={styles.statLabel}>Ожидают загрузки</div>
          </div>
          <div
            style={{
              ...styles.statCard,
              borderColor: filter === 'indexed' ? STATUS_COLORS.indexed : '#e5e7eb'
            }}
            onClick={() => setFilter('indexed')}
          >
            <div style={styles.statValue}>{stats.indexed}</div>
            <div style={styles.statLabel}>В RAG</div>
          </div>
          <div
            style={{
              ...styles.statCard,
              borderColor: filter === 'rejected' ? STATUS_COLORS.rejected : '#e5e7eb'
            }}
            onClick={() => setFilter('rejected')}
          >
            <div style={styles.statValue}>{stats.rejected}</div>
            <div style={styles.statLabel}>Отклонены</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        <button
          style={styles.downloadBtn}
          onClick={downloadPending}
          disabled={processing || (stats?.pending || 0) === 0}
        >
          {processing ? '⏳ Загрузка...' : `📦 Скачать ожидающие (${stats?.pending || 0})`}
        </button>
        {filter === 'pending' && selected.size > 0 && (
          <button
            style={styles.markIndexedBtn}
            onClick={markSelectedAsIndexed}
            disabled={processing}
          >
            ✅ Отметить как загруженные ({selected.size})
          </button>
        )}
      </div>

      {/* Instructions */}
      <div style={styles.instructions}>
        <strong>Инструкция:</strong>
        <ol style={styles.instructionsList}>
          <li>Нажмите "Скачать ожидающие" для получения архива</li>
          <li>Загрузите файлы в <a href="https://cloud.timeweb.com" target="_blank" rel="noopener noreferrer">Timeweb Console</a> → Cloud AI → Агенты → База знаний</li>
          <li>Выберите загруженные документы и нажмите "Отметить как загруженные"</li>
        </ol>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.loading}>Загрузка...</div>
        ) : documents.length === 0 ? (
          <div style={styles.empty}>
            Нет документов со статусом "{STATUS_LABELS[filter]}"
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {filter === 'pending' && (
                  <th style={styles.th}>
                    <input
                      type="checkbox"
                      checked={selected.size === documents.length && documents.length > 0}
                      onChange={selectAll}
                    />
                  </th>
                )}
                <th style={styles.th}>Документ</th>
                <th style={styles.th}>Тип</th>
                <th style={styles.th}>Размер</th>
                <th style={styles.th}>Дата</th>
                <th style={styles.th}>Статус</th>
                <th style={styles.th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} style={styles.tr}>
                  {filter === 'pending' && (
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selected.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                      />
                    </td>
                  )}
                  <td style={styles.td}>
                    <div style={styles.docName}>{doc.title}</div>
                    <div style={styles.docFilename}>{doc.original_filename}</div>
                  </td>
                  <td style={styles.td}>{doc.file_type?.toUpperCase()}</td>
                  <td style={styles.td}>{formatFileSize(doc.file_size)}</td>
                  <td style={styles.td}>{formatDate(doc.created_at)}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: STATUS_COLORS[doc.rag_status] + '20',
                      color: STATUS_COLORS[doc.rag_status]
                    }}>
                      {STATUS_LABELS[doc.rag_status]}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={doc.rag_status}
                      onChange={(e) => updateStatus(doc.id, e.target.value)}
                      style={styles.statusSelect}
                    >
                      <option value="pending">Ожидает</option>
                      <option value="indexed">В RAG</option>
                      <option value="rejected">Отклонён</option>
                      <option value="not_for_rag">Не для RAG</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#1a1a2e',
    margin: 0
  },
  subtitle: {
    color: '#6b7280',
    marginTop: '4px'
  },
  statsRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    flex: 1,
    padding: '20px',
    background: 'white',
    borderRadius: '12px',
    border: '2px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1a1a2e'
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  downloadBtn: {
    padding: '12px 24px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px'
  },
  markIndexedBtn: {
    padding: '12px 24px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px'
  },
  instructions: {
    padding: '16px',
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    marginBottom: '24px',
    fontSize: '14px'
  },
  instructionsList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px'
  },
  tableContainer: {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  },
  loading: {
    padding: '48px',
    textAlign: 'center',
    color: '#6b7280'
  },
  empty: {
    padding: '48px',
    textAlign: 'center',
    color: '#6b7280'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151'
  },
  tr: {
    borderBottom: '1px solid #f3f4f6'
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px'
  },
  docName: {
    fontWeight: 500,
    color: '#1f2937'
  },
  docFilename: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '2px'
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500
  },
  statusSelect: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  }
}
