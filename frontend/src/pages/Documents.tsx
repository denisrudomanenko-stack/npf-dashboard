import { useEffect, useState, useRef } from 'react'
import { api } from '../services/api'
import { usePermissions } from '../hooks/usePermissions'

interface Document {
  id: number
  filename: string
  original_filename: string
  file_type: string
  file_size: number
  document_type: string
  title: string
  status: string
  chunk_count: number
  indexed_at: string | null
  created_by_id: number | null
  created_at: string
}

interface Stats {
  total_documents: number
  total_chunks: number
  indexed_documents: number
}

const MAX_FILE_SIZE_MB = 30
const MAX_INDEX_SIZE_MB = 10
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024 // 30 MB
const MAX_INDEX_SIZE = MAX_INDEX_SIZE_MB * 1024 * 1024 // 10 MB

const DOC_TYPES = [
  { value: 'regulation', label: 'Регламент' },
  { value: 'product', label: 'Продукт (ПДС, КПП)' },
  { value: 'presentation', label: 'Презентация' },
  { value: 'contract_template', label: 'Шаблон договора' },
  { value: 'analytics', label: 'Аналитика' },
  { value: 'faq', label: 'FAQ' },
  { value: 'methodology', label: 'Методика' },
  { value: 'instruction', label: 'Инструкция' },
  { value: 'other', label: 'Другое' },
]

function Documents() {
  const { canEdit, canVectorize, canEditEntity } = usePermissions()
  const [documents, setDocuments] = useState<Document[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState('other')
  const [processing, setProcessing] = useState<number | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [namingDoc, setNamingDoc] = useState<Document | null>(null)
  const [suggestedName, setSuggestedName] = useState('')
  const [customName, setCustomName] = useState('')
  const [namingLoading, setNamingLoading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [vectorizeDoc, setVectorizeDoc] = useState<Document | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadDocuments()
    loadStats()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await api.get('/documents/')
      setDocuments(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Failed to load documents:', error)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await api.get('/rag/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const openUploadModal = () => {
    setSelectedType('other')
    setShowUploadModal(true)
  }

  const confirmUpload = () => {
    setShowUploadModal(false)
    fileInputRef.current?.click()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      alert(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ).\nМаксимальный размер: ${MAX_FILE_SIZE_MB} МБ`)
      e.target.value = ''
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', selectedType)
    formData.append('auto_index', 'false') // Never auto-index

    try {
      const response = await api.post('/documents/upload', formData)
      alert(`Файл загружен: ${response.data.filename}\n\nДля добавления в поисковый индекс нажмите "Векторизировать"`)
      loadDocuments()
      loadStats()
    } catch (error: any) {
      alert(`Ошибка загрузки: ${error.response?.data?.detail || error.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Удалить документ "${doc.title}"?`)) return

    setProcessing(doc.id)
    try {
      await api.delete(`/documents/${doc.id}`)
      loadDocuments()
      loadStats()
    } catch (error: any) {
      alert(`Ошибка удаления: ${error.response?.data?.detail || error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const handleDownload = (doc: Document) => {
    window.open(`/api/v1/documents/${doc.id}/download`, '_blank')
  }

  const handleArchive = async (doc: Document) => {
    if (!confirm(`Переместить документ "${doc.title || doc.original_filename}" в архив?`)) return

    setProcessing(doc.id)
    try {
      await api.patch(`/documents/${doc.id}/archive`)
      loadDocuments()
      loadStats()
    } catch (error: any) {
      alert(`Ошибка архивации: ${error.response?.data?.detail || error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const openVectorizeModal = (doc: Document) => {
    // Check file size limit for indexing
    if (doc.file_size && doc.file_size > MAX_INDEX_SIZE) {
      alert(`Файл слишком большой для индексации (${(doc.file_size / 1024 / 1024).toFixed(1)} МБ).\nМаксимальный размер: ${MAX_INDEX_SIZE_MB} МБ`)
      return
    }
    setVectorizeDoc(doc)
  }

  const handleVectorize = async () => {
    if (!vectorizeDoc) return

    setProcessing(vectorizeDoc.id)
    setVectorizeDoc(null)
    try {
      await api.post(`/documents/${vectorizeDoc.id}/reindex`)
      alert(`Документ "${vectorizeDoc.title || vectorizeDoc.original_filename}" добавлен в поисковый индекс`)
      loadDocuments()
      loadStats()
    } catch (error: any) {
      alert(`Ошибка индексации: ${error.response?.data?.detail || error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const handleInlineCategoryChange = async (docId: number, newCategory: string) => {
    setProcessing(docId)
    try {
      const formData = new FormData()
      formData.append('document_type', newCategory)
      await api.patch(`/documents/${docId}/category`, formData)
      loadDocuments()
    } catch (error: any) {
      alert(`Ошибка: ${error.response?.data?.detail || error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const openNamingModal = async (doc: Document) => {
    setNamingDoc(doc)
    setCustomName(doc.title || doc.original_filename)
    setSuggestedName('')
    setNamingLoading(true)

    try {
      const response = await api.post(`/documents/${doc.id}/suggest-name`)
      setSuggestedName(response.data.suggested_name)
      setCustomName(response.data.suggested_name)
    } catch (error: any) {
      console.error('Failed to get name suggestion:', error)
      setSuggestedName('')
    } finally {
      setNamingLoading(false)
    }
  }

  const handleRename = async () => {
    if (!namingDoc || !customName.trim()) return

    setProcessing(namingDoc.id)
    try {
      const formData = new FormData()
      formData.append('new_title', customName.trim())
      await api.patch(`/documents/${namingDoc.id}/rename`, formData)
      setNamingDoc(null)
      loadDocuments()
    } catch (error: any) {
      alert(`Ошибка переименования: ${error.response?.data?.detail || error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (doc: Document) => {
    if (doc.indexed_at && doc.chunk_count > 0) {
      return <span className="status-badge status-vectorized">В индексе ({doc.chunk_count})</span>
    }
    if (doc.status === 'active') {
      return <span className="status-badge status-uploaded">Загружен</span>
    }
    if (doc.status === 'archived') {
      return <span className="status-badge status-archived">Архив</span>
    }
    return <span className="status-badge">{doc.status}</span>
  }

  const getTypeLabel = (type: string) => {
    return DOC_TYPES.find(t => t.value === type)?.label || type
  }

  return (
    <div className="docs-wrapper">
      {/* Left Sidebar */}
      <aside className="docs-panel">
        <div className="panel-title">База знаний</div>

        {/* Stats */}
        <div className="stats-card" title="Статистика векторной базы знаний ChromaDB">
          <div className="stat-row">
            <span className="stat-icon">📄</span>
            <span className="stat-label">Документов</span>
            <span className="stat-value">{stats?.total_documents || 0}</span>
          </div>
          <div className="stat-row">
            <span className="stat-icon">✅</span>
            <span className="stat-label">В индексе</span>
            <span className="stat-value">{stats?.indexed_documents || 0}</span>
          </div>
          <div className="stat-row">
            <span className="stat-icon">🧩</span>
            <span className="stat-label">Фрагментов</span>
            <span className="stat-value">{stats?.total_chunks || 0}</span>
          </div>
        </div>

        {/* Upload */}
        {canEdit && (
          <div className="upload-section">
            <div className="panel-subtitle">Загрузка</div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv"
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
            <button
              className="upload-btn"
              onClick={openUploadModal}
              disabled={uploading}
              title="Загрузить новый документ. Сначала выберите категорию, затем файл."
            >
              {uploading ? (
                <><span className="spinner-sm"></span> Загрузка...</>
              ) : (
                <>📁 Загрузить документ</>
              )}
            </button>
            <div className="upload-hint">
              PDF, DOCX, TXT, XLSX, CSV<br/>
              Макс. размер: {MAX_FILE_SIZE_MB} МБ
            </div>
          </div>
        )}

        {/* Info */}
        <div className="info-section">
          <div className="panel-subtitle">Действия</div>
          <div className="info-item" title="Добавить документ в поисковый индекс для семантического поиска (макс. 10 МБ)">
            🔍 <strong>Векторизировать</strong> — индексация
          </div>
          <div className="info-item" title="Нажмите на название документа для изменения">
            ✏️ <strong>Название</strong> — кликните для редактирования
          </div>
          <div className="info-item" title="Выберите категорию из выпадающего списка">
            📂 <strong>Категория</strong> — выбор из списка
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="docs-main">
        <header className="docs-header">
          <h1>Документы</h1>
          <span className="docs-count">{documents.length} файлов</span>
        </header>

        <div className="docs-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <span>Загрузка документов...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <h2>Нет документов</h2>
              <p>Загрузите первый документ через панель слева</p>
            </div>
          ) : (
            <div className="table-wrapper">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Документ</th>
                  <th>Категория</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className={processing === doc.id ? 'processing' : ''}>
                    <td className="doc-name-cell">
                      {canEditEntity(doc.created_by_id) ? (
                        <div
                          className="doc-name editable"
                          onClick={() => openNamingModal(doc)}
                          title="Нажмите для изменения названия"
                        >
                          {doc.title || doc.original_filename}
                          <span className="edit-icon">✏️</span>
                        </div>
                      ) : (
                        <div className="doc-name" title={canEdit ? "Вы можете редактировать только свои документы" : "Только просмотр"}>
                          {doc.title || doc.original_filename}
                        </div>
                      )}
                      <div className="doc-meta">{doc.file_type?.toUpperCase()}</div>
                    </td>
                    <td>
                      <select
                        className="category-select"
                        value={doc.document_type || 'other'}
                        onChange={(e) => handleInlineCategoryChange(doc.id, e.target.value)}
                        disabled={!canEditEntity(doc.created_by_id) || processing === doc.id}
                        title={canEditEntity(doc.created_by_id) ? "Выберите категорию документа" : (canEdit ? "Вы можете редактировать только свои документы" : "Только просмотр")}
                      >
                        {DOC_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>{getStatusBadge(doc)}</td>
                    <td className="actions-cell">
                      {canVectorize ? (
                        <button
                          className="action-btn-text btn-vectorize"
                          onClick={() => openVectorizeModal(doc)}
                          disabled={processing === doc.id || (doc.indexed_at !== null && doc.chunk_count > 0)}
                          title={doc.indexed_at ? `Уже в индексе (${doc.chunk_count} фрагм.)` : `Добавить в поисковый индекс (макс. ${MAX_INDEX_SIZE_MB} МБ)`}
                        >
                          🔍 Векторизировать
                        </button>
                      ) : canEdit && (
                        <button
                          className="action-btn-text btn-vectorize"
                          disabled
                          title="Векторизация доступна только администраторам"
                          style={{ opacity: 0.4, cursor: 'not-allowed' }}
                        >
                          🔍 Векторизировать
                        </button>
                      )}
                      <button
                        className="action-btn-icon"
                        onClick={() => setPreviewDoc(doc)}
                        title="Открыть для просмотра"
                      >
                        📖
                      </button>
                      {canEditEntity(doc.created_by_id) ? (
                        <button
                          className="action-btn-icon"
                          onClick={() => handleArchive(doc)}
                          disabled={processing === doc.id || doc.status === 'archived'}
                          title="Переместить в архив"
                        >
                          📦
                        </button>
                      ) : canEdit && (
                        <button
                          className="action-btn-icon"
                          disabled
                          title="Вы можете архивировать только свои документы"
                          style={{ opacity: 0.4, cursor: 'not-allowed' }}
                        >
                          📦
                        </button>
                      )}
                      <button
                        className="action-btn-icon"
                        onClick={() => handleDownload(doc)}
                        title="Скачать файл"
                      >
                        ⬇️
                      </button>
                      {canEditEntity(doc.created_by_id) ? (
                        <button
                          className="action-btn-icon btn-delete"
                          onClick={() => handleDelete(doc)}
                          disabled={processing === doc.id}
                          title="Удалить документ"
                        >
                          🗑️
                        </button>
                      ) : canEdit && (
                        <button
                          className="action-btn-icon btn-delete"
                          disabled
                          title="Вы можете удалять только свои документы"
                          style={{ opacity: 0.4, cursor: 'not-allowed' }}
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </main>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewDoc.title || previewDoc.original_filename}</h3>
              <button className="close-btn" onClick={() => setPreviewDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-row"><span>Файл:</span><strong>{previewDoc.original_filename}</strong></div>
              <div className="modal-row"><span>Категория:</span><strong>{getTypeLabel(previewDoc.document_type)}</strong></div>
              <div className="modal-row"><span>Формат:</span><strong>{previewDoc.file_type?.toUpperCase()}</strong></div>
              <div className="modal-row"><span>Статус:</span><strong>{previewDoc.status}</strong></div>
              <div className="modal-row"><span>Фрагментов:</span><strong>{previewDoc.chunk_count || 0}</strong></div>
              <div className="modal-row"><span>Загружен:</span><strong>{new Date(previewDoc.created_at).toLocaleString('ru')}</strong></div>
              {previewDoc.indexed_at && (
                <div className="modal-row"><span>Индексирован:</span><strong>{new Date(previewDoc.indexed_at).toLocaleString('ru')}</strong></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Naming Modal */}
      {namingDoc && (
        <div className="modal-overlay" onClick={() => setNamingDoc(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Название документа</h3>
              <button className="close-btn" onClick={() => setNamingDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-doc-name">{namingDoc.original_filename}</p>

              {namingLoading ? (
                <div className="naming-loading">
                  <div className="spinner"></div>
                  <span>AI анализирует документ...</span>
                </div>
              ) : (
                <>
                  {suggestedName && (
                    <div className="suggestion-box">
                      <div className="suggestion-label">Рекомендация AI:</div>
                      <div className="suggestion-text">«{suggestedName}»</div>
                      <button className="btn-use" onClick={() => setCustomName(suggestedName)}>
                        Использовать
                      </button>
                    </div>
                  )}
                  <div className="form-field">
                    <label>Название</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="input-light"
                      placeholder="Введите название"
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setNamingDoc(null)}>Отмена</button>
                <button
                  className="btn-primary"
                  onClick={handleRename}
                  disabled={namingLoading || !customName.trim()}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal - Category Selection */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Загрузка документа</h3>
              <button className="close-btn" onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="upload-limits-info">
                <div className="limit-row">
                  <span>Максимальный размер файла:</span>
                  <strong>{MAX_FILE_SIZE_MB} МБ</strong>
                </div>
                <div className="limit-row hint">
                  <span>Для индексации используйте кнопку "Векторизировать"</span>
                </div>
              </div>
              <div className="form-field">
                <label>Категория документа</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="select-light"
                >
                  {DOC_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <span className="field-hint">Влияет на размер фрагментов при индексации</span>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setShowUploadModal(false)}>Отмена</button>
                <button className="btn-primary" onClick={confirmUpload}>Выбрать файл</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vectorize Modal */}
      {vectorizeDoc && (
        <div className="modal-overlay" onClick={() => setVectorizeDoc(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Индексация документа</h3>
              <button className="close-btn" onClick={() => setVectorizeDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-doc-name">{vectorizeDoc.title || vectorizeDoc.original_filename}</p>
              <div className="vectorize-info">
                <p>Документ будет разбит на фрагменты и добавлен в поисковый индекс для семантического поиска.</p>
                <div className="limit-row">
                  <span>Макс. размер для индексации:</span>
                  <strong>{MAX_INDEX_SIZE_MB} МБ</strong>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setVectorizeDoc(null)}>Отмена</button>
                <button className="btn-primary" onClick={handleVectorize}>Векторизировать</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .docs-wrapper {
          position: fixed;
          top: 73px;
          left: 0;
          right: 0;
          bottom: 0;
          display: grid;
          grid-template-columns: 240px 1fr;
          background: var(--background);
        }

        /* Left Panel */
        .docs-panel {
          background: #1a1a2e;
          color: #fff;
          display: flex;
          flex-direction: column;
          padding: 16px;
          gap: 16px;
          overflow-y: auto;
        }
        .panel-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #888;
          padding: 0 4px;
        }
        .panel-subtitle {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
          margin-bottom: 8px;
        }

        /* Stats Card */
        .stats-card {
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 12px;
        }
        .stat-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
        }
        .stat-row:not(:last-child) {
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .stat-icon { font-size: 14px; }
        .stat-label {
          flex: 1;
          font-size: 12px;
          color: #aaa;
        }
        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        /* Upload Section */
        .upload-section {
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          padding: 12px;
        }
        .upload-field {
          margin-bottom: 12px;
        }
        .field-label {
          display: block;
          font-size: 11px;
          color: #888;
          margin-bottom: 6px;
        }
        .select-dark {
          width: 100%;
          padding: 8px 10px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
        }
        .select-dark option {
          background: #1a1a2e;
        }
        .upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px;
          background: var(--primary);
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .upload-btn:hover {
          opacity: 0.9;
        }
        .upload-hint {
          font-size: 10px;
          color: #666;
          text-align: center;
          margin-top: 8px;
        }
        .spinner-sm {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Info Section */
        .info-section {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .info-item {
          font-size: 11px;
          color: #888;
          padding: 4px 0;
          line-height: 1.4;
        }
        .info-item strong {
          color: #aaa;
        }

        /* Main Content */
        .docs-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
        .docs-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          background: #fff;
          border-bottom: 1px solid var(--border);
        }
        .docs-header h1 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .docs-count {
          font-size: 13px;
          color: var(--text-muted);
        }

        .docs-content {
          flex: 1;
          overflow: auto;
          padding: 20px 24px;
        }
        .table-wrapper {
          overflow-x: auto;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        /* States */
        .loading-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 12px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .empty-state h2 {
          font-size: 18px;
          color: var(--text);
          margin: 0 0 8px;
        }
        .empty-state p {
          margin: 0;
        }

        /* Table */
        .docs-table {
          width: 100%;
          min-width: 700px;
          border-collapse: collapse;
        }
        .docs-table th {
          text-align: left;
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          background: #f8f9fa;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .docs-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
          vertical-align: middle;
        }
        .docs-table tr:last-child td {
          border-bottom: none;
        }
        .docs-table tr.processing {
          opacity: 0.5;
        }
        .doc-name-cell {
          min-width: 200px;
          max-width: 300px;
        }
        .doc-name {
          font-weight: 500;
          font-size: 14px;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .doc-name.editable {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .doc-name.editable:hover {
          color: var(--primary);
        }
        .edit-icon {
          font-size: 10px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .doc-name.editable:hover .edit-icon,
        .category-select-wrapper:hover .edit-icon {
          opacity: 0.6;
        }
        .doc-meta {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .category-chip {
          display: inline-block;
          padding: 4px 8px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
        }

        /* Status Badges */
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
        .status-vectorized {
          background: #dcfce7;
          color: #166534;
        }
        .status-uploaded {
          background: #dbeafe;
          color: #1e40af;
        }
        .status-archived {
          background: #f1f5f9;
          color: #475569;
        }

        /* Actions */
        .actions-cell {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .action-btn-icon {
          width: 32px;
          height: 32px;
          padding: 0;
          font-size: 14px;
          border: none;
          background: #f8f9fa;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .action-btn-icon:hover:not(:disabled) {
          background: #e9ecef;
          transform: scale(1.05);
        }
        .action-btn-icon:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .action-btn-icon.btn-delete:hover:not(:disabled) {
          background: #fee2e2;
        }
        .action-btn-text {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .action-btn-text:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .action-btn-text.btn-vectorize {
          background: #dbeafe;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }
        .action-btn-text.btn-vectorize:hover:not(:disabled) {
          background: #bfdbfe;
        }

        /* Category Select */
        .category-select {
          padding: 6px 10px;
          font-size: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          min-width: 120px;
        }
        .category-select:hover:not(:disabled) {
          border-color: var(--primary);
        }
        .category-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Vectorize Info */
        .vectorize-info {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .vectorize-info p {
          margin: 0 0 8px;
          font-size: 13px;
          color: #0369a1;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: #fff;
          border-radius: 12px;
          width: 90%;
          max-width: 420px;
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
          font-weight: 600;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: var(--text-muted);
          padding: 4px;
        }
        .modal-body {
          padding: 20px;
        }
        .modal-doc-name {
          font-weight: 500;
          margin: 0 0 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }
        .modal-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
        }
        .modal-row span {
          color: var(--text-muted);
        }
        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #f0f0f0;
        }
        .btn-cancel {
          padding: 10px 16px;
          background: none;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-cancel:hover {
          background: #f5f5f5;
        }
        .btn-primary {
          padding: 10px 16px;
          background: var(--primary);
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Upload Limits Info */
        .upload-limits-info {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .limit-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 4px 0;
        }
        .limit-row span {
          color: var(--text-muted);
        }
        .limit-row strong {
          color: var(--text);
        }
        .limit-row.hint {
          justify-content: center;
          padding-top: 8px;
          border-top: 1px solid #e9ecef;
          margin-top: 8px;
        }
        .limit-row.hint span {
          font-size: 11px;
          font-style: italic;
        }

        /* Form Fields */
        .form-field {
          margin-bottom: 16px;
        }
        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .select-light, .input-light {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 14px;
        }
        .select-light:focus, .input-light:focus {
          outline: none;
          border-color: var(--primary);
        }
        .field-hint {
          display: block;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        /* Naming Modal */
        .naming-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 24px;
          color: var(--text-muted);
          justify-content: center;
        }
        .suggestion-box {
          background: #f5f3ff;
          border: 1px solid #ddd6fe;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .suggestion-label {
          font-size: 11px;
          color: #7c3aed;
          margin-bottom: 4px;
        }
        .suggestion-text {
          font-size: 14px;
          font-weight: 500;
          color: #5b21b6;
          margin-bottom: 8px;
        }
        .btn-use {
          padding: 6px 12px;
          background: #7c3aed;
          border: none;
          border-radius: 4px;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-use:hover {
          background: #6d28d9;
        }

        /* Responsive - Large tablets */
        @media (max-width: 1200px) {
          .docs-wrapper {
            grid-template-columns: 220px 1fr;
          }
          .docs-panel {
            padding: 12px;
          }
          .docs-content {
            padding: 16px;
          }
        }

        /* Responsive - Tablets */
        @media (max-width: 1000px) {
          .docs-wrapper {
            grid-template-columns: 200px 1fr;
          }
          .action-btn-icon {
            width: 28px;
            height: 28px;
            font-size: 12px;
          }
          .action-btn-text {
            padding: 4px 8px;
            font-size: 10px;
          }
        }

        /* Responsive - Small tablets */
        @media (max-width: 800px) {
          .docs-wrapper {
            grid-template-columns: 60px 1fr;
          }
          .docs-panel {
            padding: 8px;
            align-items: center;
          }
          .panel-title, .panel-subtitle,
          .stat-label, .upload-hint,
          .info-section {
            display: none;
          }
          .stats-card {
            padding: 8px;
          }
          .stat-row {
            justify-content: center;
          }
          .stat-value {
            display: none;
          }
          .upload-btn {
            padding: 8px;
            font-size: 16px;
          }
          .upload-btn span:not(.spinner-sm) {
            display: none;
          }
          .docs-header {
            padding: 12px 16px;
          }
          .docs-content {
            padding: 12px;
          }
          /* Table horizontal scroll */
          .docs-table-wrapper {
            overflow-x: auto;
          }
          table {
            min-width: 600px;
          }
        }

        /* Responsive - Mobile */
        @media (max-width: 640px) {
          .docs-wrapper {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }
          .docs-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            flex-direction: row;
            padding: 8px 12px;
            background: white;
            border-top: 1px solid var(--border);
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            z-index: 100;
            justify-content: space-around;
          }
          .stats-section,
          .info-section {
            display: none;
          }
          .upload-section {
            margin: 0;
          }
          .upload-btn {
            padding: 10px 16px;
            border-radius: 20px;
          }
          .upload-btn span:not(.spinner-sm) {
            display: inline;
            font-size: 12px;
          }
          .docs-main {
            padding-bottom: 70px;
          }
          .docs-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            padding: 12px;
          }
          .docs-header h1 {
            font-size: 18px;
          }
          .docs-content {
            padding: 8px;
          }
          /* Table mobile */
          table {
            min-width: 500px;
          }
          th, td {
            padding: 8px 6px;
            font-size: 12px;
          }
          .doc-name-cell {
            max-width: 150px;
          }
          .doc-name {
            font-size: 12px;
          }
          .doc-meta {
            font-size: 9px;
          }
          .category-select {
            padding: 4px 6px;
            font-size: 11px;
            max-width: 100px;
          }
          .actions-cell {
            display: flex;
            gap: 2px;
            flex-wrap: wrap;
          }
          .action-btn-text {
            display: none;
          }
          .action-btn-icon {
            width: 26px;
            height: 26px;
            font-size: 11px;
          }
          /* Modals mobile */
          .modal {
            width: 95vw;
            max-width: 400px;
            max-height: 80vh;
          }
          .modal-header {
            padding: 12px 16px;
          }
          .modal-header h2 {
            font-size: 16px;
          }
          .modal-body {
            padding: 16px;
          }
          .modal-footer {
            padding: 12px 16px;
            flex-direction: column;
            gap: 8px;
          }
          .modal-footer button {
            width: 100%;
          }
          .llm-badge {
            font-size: 9px;
            padding: 2px 6px;
          }
        }

        /* Very small screens */
        @media (max-width: 380px) {
          .docs-header h1 {
            font-size: 16px;
          }
          table {
            min-width: 400px;
          }
          .action-btn-icon {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>
    </div>
  )
}

export default Documents
