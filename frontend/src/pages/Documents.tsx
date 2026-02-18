import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface Document {
  id: number
  filename: string
  original_filename: string
  file_type: string
  document_type: string
  title: string
  status: string
  chunk_count: number
  created_at: string
}

function Documents() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await api.get('/documents')
      setDocuments(response.data)
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post('/documents/upload', formData)
      loadDocuments()
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleReindex = async (id: number) => {
    try {
      await api.post(`/documents/${id}/reindex`)
      loadDocuments()
    } catch (error) {
      console.error('Reindex failed:', error)
    }
  }

  const handleArchive = async (id: number) => {
    try {
      await api.patch(`/documents/${id}/archive`)
      loadDocuments()
    } catch (error) {
      console.error('Archive failed:', error)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="documents">
      <div className="page-header">
        <div>
          <h2>База знаний (RAG)</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Загруженные документы индексируются для AI-ассистента
          </p>
        </div>
        <div className="upload-section">
          <input
            type="file"
            id="file-upload"
            accept=".pdf,.docx,.txt,.xlsx,.csv"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload" className="btn btn-primary">
            {uploading ? 'Загрузка...' : 'Загрузить документ'}
          </label>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Документ</th>
              <th>Тип</th>
              <th>Фрагменты</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Нет загруженных документов
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <strong>{doc.title || doc.original_filename}</strong>
                    <br />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {doc.file_type?.toUpperCase()}
                    </span>
                  </td>
                  <td>{doc.document_type}</td>
                  <td>{doc.chunk_count}</td>
                  <td>
                    <span className={`status-badge status-${doc.status}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="action-btn"
                      onClick={() => handleReindex(doc.id)}
                      title="Переиндексировать"
                    >
                      Reindex
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleArchive(doc.id)}
                      title="Архивировать"
                    >
                      Archive
                    </button>
                  </td>
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
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .action-btn {
          padding: 0.25rem 0.5rem;
          margin-right: 0.5rem;
          font-size: 0.75rem;
          border: 1px solid var(--border);
          background: white;
          border-radius: 4px;
        }
        .action-btn:hover {
          background: var(--background);
        }
      `}</style>
    </div>
  )
}

export default Documents
