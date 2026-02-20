import { useEffect, useState, useRef } from 'react'
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
  indexed_at: string | null
  created_at: string
}

interface Stats {
  total_documents: number
  total_chunks: number
  indexed_documents: number
}

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
  const [documents, setDocuments] = useState<Document[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState('other')
  const [processing, setProcessing] = useState<number | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [vectorizeDoc, setVectorizeDoc] = useState<Document | null>(null)
  const [vectorizeType, setVectorizeType] = useState('')
  const [namingDoc, setNamingDoc] = useState<Document | null>(null)
  const [suggestedName, setSuggestedName] = useState('')
  const [customName, setCustomName] = useState('')
  const [namingLoading, setNamingLoading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [categoryDoc, setCategoryDoc] = useState<Document | null>(null)
  const [categoryType, setCategoryType] = useState('')
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

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', selectedType)
    formData.append('auto_index', 'false')

    try {
      const response = await api.post('/documents/upload', formData)
      alert(`Файл загружен: ${response.data.filename}`)
      loadDocuments()
      loadStats()
    } catch (error: any) {
      alert(`Ошибка загрузки: ${error.response?.data?.detail || error.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const openCategoryModal = (doc: Document) => {
    setCategoryDoc(doc)
    setCategoryType(doc.document_type || 'other')
  }

  const handleCategoryChange = async () => {
    if (!categoryDoc) return

    setProcessing(categoryDoc.id)
    setCategoryDoc(null)
    try {
      const formData = new FormData()
      formData.append('document_type', categoryType)
      await api.patch(`/documents/${categoryDoc.id}/category`, formData)
      loadDocuments()
    } catch (error: any) {
      alert(`Ошибка: ${error.response?.data?.detail || error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const openVectorizeModal = (doc: Document) => {
    setVectorizeDoc(doc)
    setVectorizeType(doc.document_type || 'other')
  }

  const handleVectorize = async () => {
    if (!vectorizeDoc) return

    setProcessing(vectorizeDoc.id)
    setVectorizeDoc(null)
    try {
      await api.post(`/documents/${vectorizeDoc.id}/reindex`, { document_type: vectorizeType })
      alert(`Документ "${vectorizeDoc.title}" векторизирован`)
      loadDocuments()
      loadStats()
    } catch (error: any) {
      alert(`Ошибка векторизации: ${error.response?.data?.detail || error.message}`)
    } finally {
      setProcessing(null)
    }
  }

  const handleOCR = async (doc: Document) => {
    setProcessing(doc.id)
    try {
      const response = await api.post(`/documents/${doc.id}/ocr`)
      alert(`OCR выполнен: ${response.data.message}`)
      loadDocuments()
    } catch (error: any) {
      alert(`OCR недоступен: ${error.response?.data?.detail || 'Требуется настройка Anthropic API'}`)
    } finally {
      setProcessing(null)
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
          <div className="upload-hint">PDF, DOCX, TXT, XLSX, CSV</div>
        </div>

        {/* Info */}
        <div className="info-section">
          <div className="panel-subtitle">Справка</div>
          <div className="info-item" title="AI анализирует первые страницы и предлагает осмысленное название">
            🧠 <strong>Обработать AI</strong> — автоназвание
          </div>
          <div className="info-item" title="Разбивает документ на фрагменты и добавляет в векторный индекс">
            🧠 <strong>Векторизировать</strong> — добавить в RAG
          </div>
          <div className="info-item" title="Распознавание текста на сканированных PDF (требует Claude API)">
            👁 <strong>OCR</strong> — распознать скан
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
                      <div className="doc-name">{doc.title || doc.original_filename}</div>
                      <div className="doc-meta">{doc.file_type?.toUpperCase()} • {doc.original_filename}</div>
                    </td>
                    <td><span className="category-chip">{getTypeLabel(doc.document_type)}</span></td>
                    <td>{getStatusBadge(doc)}</td>
                    <td className="actions-cell">
                      <button
                        className="action-btn-text btn-naming"
                        onClick={() => openNamingModal(doc)}
                        disabled={processing === doc.id}
                        title="AI-анализ: извлечение первых страниц, определение темы, генерация названия"
                      >
                        🧠 Обработать AI
                      </button>
                      <button
                        className="action-btn-text btn-vectorize"
                        onClick={() => openVectorizeModal(doc)}
                        disabled={processing === doc.id}
                        title="Разбить на фрагменты и добавить в ChromaDB для семантического поиска"
                      >
                        🧠 Векторизировать
                      </button>
                      <button
                        className="action-btn-icon"
                        onClick={() => setPreviewDoc(doc)}
                        title="Просмотр метаданных: название, категория, статус, даты"
                      >
                        📋
                      </button>
                      {doc.file_type === 'pdf' && (
                        <button
                          className="action-btn-icon"
                          onClick={() => handleOCR(doc)}
                          disabled={processing === doc.id}
                          title="OCR через Claude Vision API для сканированных документов"
                        >
                          👁
                        </button>
                      )}
                      <button
                        className="action-btn-icon"
                        onClick={() => openCategoryModal(doc)}
                        disabled={processing === doc.id}
                        title="Изменить категорию документа"
                      >
                        🏷️
                      </button>
                      <button
                        className="action-btn-icon"
                        onClick={() => handleDownload(doc)}
                        title="Скачать оригинальный файл"
                      >
                        ⬇️
                      </button>
                      <button
                        className="action-btn-icon btn-delete"
                        onClick={() => handleDelete(doc)}
                        disabled={processing === doc.id}
                        title="Удалить документ и все его фрагменты из индекса"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Vectorize Modal */}
      {vectorizeDoc && (
        <div className="modal-overlay" onClick={() => setVectorizeDoc(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Векторизация</h3>
              <button className="close-btn" onClick={() => setVectorizeDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-doc-name">{vectorizeDoc.title || vectorizeDoc.original_filename}</p>
              <div className="form-field">
                <label>Категория документа</label>
                <select
                  value={vectorizeType}
                  onChange={(e) => setVectorizeType(e.target.value)}
                  className="select-light"
                >
                  {DOC_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <span className="field-hint">Влияет на размер фрагментов при разбиении</span>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setVectorizeDoc(null)}>Отмена</button>
                <button className="btn-primary" onClick={handleVectorize}>Векторизировать</button>
              </div>
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
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                Выберите категорию перед загрузкой файла
              </p>
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
                <span className="field-hint">Влияет на размер фрагментов при векторизации</span>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setShowUploadModal(false)}>Отмена</button>
                <button className="btn-primary" onClick={confirmUpload}>Выбрать файл</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Change Modal */}
      {categoryDoc && (
        <div className="modal-overlay" onClick={() => setCategoryDoc(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Изменить категорию</h3>
              <button className="close-btn" onClick={() => setCategoryDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-doc-name">{categoryDoc.title || categoryDoc.original_filename}</p>
              <div className="form-field">
                <label>Категория</label>
                <select
                  value={categoryType}
                  onChange={(e) => setCategoryType(e.target.value)}
                  className="select-light"
                >
                  {DOC_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setCategoryDoc(null)}>Отмена</button>
                <button className="btn-primary" onClick={handleCategoryChange}>Сохранить</button>
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
          display: flex;
          background: var(--background);
        }

        /* Left Panel */
        .docs-panel {
          width: 240px;
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
          overflow-y: auto;
          padding: 20px 24px;
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
          border-collapse: collapse;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
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
        .doc-meta {
          font-size: 11px;
          color: var(--text-muted);
        }
        .category-chip {
          display: inline-block;
          padding: 4px 8px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 12px;
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
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .action-btn-text {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid transparent;
          border-radius: 20px;
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
        .action-btn-text.btn-naming {
          background: #f3e8ff;
          color: #7c3aed;
          border-color: #e9d5ff;
        }
        .action-btn-text.btn-naming:hover:not(:disabled) {
          background: #ede9fe;
        }
        .action-btn-text.btn-vectorize {
          background: #dcfce7;
          color: #16a34a;
          border-color: #bbf7d0;
        }
        .action-btn-text.btn-vectorize:hover:not(:disabled) {
          background: #d1fae5;
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
      `}</style>
    </div>
  )
}

export default Documents
