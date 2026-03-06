import { useEffect, useState, useRef } from 'react'
import { api } from '../services/api'
import { usePermissions } from '../hooks/usePermissions'
import { StorageStats } from '../types'
import ErrorModal from '../components/ErrorModal'
import StorageBar from '../components/StorageBar'

interface Document {
  id: number
  filename: string
  original_filename: string
  file_type: string
  file_size: number
  document_type: string
  title: string
  description: string | null
  status: string
  rag_status: string
  chunk_count: number
  indexed_at: string | null
  created_by_id: number | null
  created_at: string
}

const RAG_STATUS_LABELS: Record<string, string> = {
  'PENDING': 'Ожидает',
  'INDEXED': 'В RAG',
  'REJECTED': 'Отклонён',
  'NOT_FOR_RAG': 'Не для RAG'
}

const RAG_STATUS_COLORS: Record<string, string> = {
  'PENDING': '#f59e0b',
  'INDEXED': '#10b981',
  'REJECTED': '#ef4444',
  'NOT_FOR_RAG': '#6b7280'
}

interface Stats {
  total_documents: number
  total_chunks: number
  indexed_documents: number
}

interface ErrorModalState {
  title: string
  message: string
  type: 'error' | 'warning' | 'info'
}

const MAX_FILE_SIZE_MB = 30
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024 // 30 MB

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
  const { canEdit, canEditEntity } = usePermissions()
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
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null)
  const [errorModal, setErrorModal] = useState<ErrorModalState | null>(null)
  const [cardDoc, setCardDoc] = useState<Document | null>(null)
  const [cardEditMode, setCardEditMode] = useState(false)
  const [cardTitle, setCardTitle] = useState('')
  const [cardDescription, setCardDescription] = useState('')
  const [cardCategory, setCardCategory] = useState('other')
  const [cardSaving, setCardSaving] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveStats, setArchiveStats] = useState<StorageStats | null>(null)
  const [archiveConfirmDoc, setArchiveConfirmDoc] = useState<Document | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadDocuments()
    loadStats()
    loadStorageStats()
    loadArchiveStats()
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

  const loadStorageStats = async () => {
    try {
      const response = await api.get('/documents/storage-stats')
      setStorageStats(response.data)
    } catch (error) {
      console.error('Failed to load storage stats:', error)
    }
  }

  const loadArchiveStats = async () => {
    try {
      const response = await api.get('/documents/archive-stats')
      setArchiveStats(response.data)
    } catch (error) {
      console.error('Failed to load archive stats:', error)
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
      setErrorModal({
        title: 'Ошибка загрузки',
        message: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ).\nМаксимальный размер: ${MAX_FILE_SIZE_MB} МБ`,
        type: 'error'
      })
      e.target.value = ''
      return
    }

    // Check storage limit
    if (storageStats && (storageStats.total_bytes + file.size) > storageStats.limit_bytes) {
      setErrorModal({
        title: 'Недостаточно места',
        message: `Недостаточно места в хранилище.\n\nИспользовано: ${storageStats.total_gb} ГБ из ${storageStats.limit_gb} ГБ\nРазмер файла: ${(file.size / 1024 / 1024).toFixed(1)} МБ\n\nУдалите ненужные документы и попробуйте снова.`,
        type: 'error'
      })
      e.target.value = ''
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', selectedType)
    formData.append('auto_index', 'false') // Never auto-index

    try {
      await api.post('/documents/upload', formData)
      setErrorModal({
        title: 'Файл загружен',
        message: 'Документ успешно загружен.',
        type: 'info'
      })
      loadDocuments()
      loadStats()
      loadStorageStats()
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.message
      setErrorModal({
        title: 'Ошибка загрузки',
        message: detail,
        type: 'error'
      })
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
      loadStorageStats()
    } catch (error: any) {
      setErrorModal({
        title: 'Ошибка удаления',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleDownload = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob'
      })

      // Create blob URL and trigger download
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.original_filename || doc.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      setErrorModal({
        title: 'Ошибка скачивания',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    }
  }

  const handleArchive = (doc: Document) => {
    // Open confirmation modal with archive stats warning
    setArchiveConfirmDoc(doc)
  }

  const confirmArchive = async () => {
    if (!archiveConfirmDoc) return

    const doc = archiveConfirmDoc
    setArchiveConfirmDoc(null)
    setProcessing(doc.id)
    try {
      await api.patch(`/documents/${doc.id}/archive`)
      loadDocuments()
      loadStats()
      loadStorageStats()
      loadArchiveStats()
    } catch (error: any) {
      setErrorModal({
        title: 'Ошибка архивации',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleRestore = async (doc: Document) => {
    setProcessing(doc.id)
    try {
      await api.patch(`/documents/${doc.id}/restore`)
      loadDocuments()
      loadStats()
      loadStorageStats()
      loadArchiveStats()
      setErrorModal({
        title: 'Документ восстановлен',
        message: `"${doc.title || doc.original_filename}" перемещён в основной реестр.`,
        type: 'info'
      })
    } catch (error: any) {
      setErrorModal({
        title: 'Ошибка восстановления',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleDeleteFromArchive = async (doc: Document) => {
    if (!confirm(`Удалить документ "${doc.title || doc.original_filename}" из архива? Это действие нельзя отменить.`)) return

    setProcessing(doc.id)
    try {
      await api.delete(`/documents/${doc.id}`)
      loadDocuments()
      loadStats()
      loadArchiveStats()
    } catch (error: any) {
      setErrorModal({
        title: 'Ошибка удаления',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    } finally {
      setProcessing(null)
    }
  }

  // Filtered documents
  const activeDocuments = documents.filter(d => d.status === 'active')
  const archivedDocuments = documents.filter(d => d.status === 'archived')

  const handleInlineCategoryChange = async (docId: number, newCategory: string) => {
    setProcessing(docId)
    try {
      const formData = new FormData()
      formData.append('document_type', newCategory)
      await api.patch(`/documents/${docId}/category`, formData)
      loadDocuments()
    } catch (error: any) {
      setErrorModal({
        title: 'Ошибка',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
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
      setErrorModal({
        title: 'Ошибка переименования',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    } finally {
      setProcessing(null)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} Б`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
  }

  const openCardModal = (doc: Document) => {
    setCardDoc(doc)
    setCardTitle(doc.title || doc.original_filename)
    setCardDescription(doc.description || '')
    setCardCategory(doc.document_type || 'other')
    setCardEditMode(false)
  }

  const handleView = async (doc: Document) => {
    // Open window immediately to avoid popup blocker
    const newWindow = window.open('about:blank', '_blank')

    if (!newWindow) {
      setErrorModal({
        title: 'Ошибка просмотра',
        message: 'Браузер заблокировал открытие окна. Разрешите всплывающие окна для этого сайта.',
        type: 'warning'
      })
      return
    }

    // Show loading message
    newWindow.document.write('<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;">Загрузка документа...</body></html>')

    try {
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob'
      })

      // Get MIME type from response or guess from file extension
      const mimeType = response.headers['content-type'] || getMimeType(doc.file_type)

      // Create blob URL and navigate the window
      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      newWindow.location.href = url

      // Revoke URL after delay to allow viewing
      setTimeout(() => window.URL.revokeObjectURL(url), 60000)
    } catch (error: any) {
      newWindow.close()
      setErrorModal({
        title: 'Ошибка просмотра',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    }
  }

  const getMimeType = (fileType: string | null): string => {
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'csv': 'text/csv'
    }
    return mimeTypes[fileType || ''] || 'application/octet-stream'
  }

  const closeCardModal = () => {
    setCardDoc(null)
    setCardEditMode(false)
  }

  const handleCardSave = async () => {
    if (!cardDoc) return

    setCardSaving(true)
    try {
      await api.patch(`/documents/${cardDoc.id}`, {
        title: cardTitle.trim(),
        description: cardDescription.trim(),
        document_type: cardCategory
      })
      setErrorModal({
        title: 'Сохранено',
        message: 'Документ успешно обновлён.',
        type: 'info'
      })
      setCardEditMode(false)
      loadDocuments()
      // Update cardDoc with new values
      setCardDoc({
        ...cardDoc,
        title: cardTitle.trim(),
        document_type: cardCategory
      })
    } catch (error: any) {
      setErrorModal({
        title: 'Ошибка сохранения',
        message: error.response?.data?.detail || error.message,
        type: 'error'
      })
    } finally {
      setCardSaving(false)
    }
  }

  const getStatusBadge = (doc: Document) => {
    if (doc.status === 'active') {
      return <span className="status-badge status-uploaded">Активен</span>
    }
    if (doc.status === 'archived') {
      return <span className="status-badge status-archived">Архив</span>
    }
    return <span className="status-badge">{doc.status}</span>
  }

  const getRagStatusBadge = (doc: Document) => {
    const status = doc.rag_status || 'PENDING'
    const label = RAG_STATUS_LABELS[status] || status
    const color = RAG_STATUS_COLORS[status] || '#6b7280'
    return (
      <span
        className="status-badge"
        style={{
          backgroundColor: color + '20',
          color: color,
          border: `1px solid ${color}40`
        }}
        title={`RAG: ${label}`}
      >
        {label}
      </span>
    )
  }

  const getTypeLabel = (type: string) => {
    return DOC_TYPES.find(t => t.value === type)?.label || type
  }

  const getStorageColor = (percent: number) => {
    if (percent >= 95) return '#dc2626' // red
    if (percent >= 80) return '#f59e0b' // orange
    return '#22c55e' // green
  }

  const getStorageBgColor = (percent: number) => {
    if (percent >= 95) return '#fef2f2'
    if (percent >= 80) return '#fffbeb'
    return '#f0fdf4'
  }

  const formatGb = (bytes: number) => {
    return (bytes / (1024 ** 3)).toFixed(2)
  }

  // Calculate archive usage after adding document
  const getArchiveUsageAfterAdd = (docSize: number) => {
    if (!archiveStats) return 0
    return ((archiveStats.total_bytes + docSize) / archiveStats.limit_bytes) * 100
  }

  return (
    <div className="docs-wrapper">
      {/* Left Sidebar */}
      <aside className="docs-panel">
        <div className="panel-title">Документы</div>

        {/* Stats */}
        <div className="stats-card" title="Статистика хранилища документов">
          <div className="stat-row">
            <span className="stat-icon">📄</span>
            <span className="stat-label">Всего</span>
            <span className="stat-value">{stats?.total_documents || 0}</span>
          </div>
          <div className="stat-row">
            <span className="stat-icon">✅</span>
            <span className="stat-label">Активных</span>
            <span className="stat-value">{activeDocuments.length}</span>
          </div>
          <div className="stat-row">
            <span className="stat-icon">📦</span>
            <span className="stat-label">В архиве</span>
            <span className="stat-value">{archivedDocuments.length}</span>
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
            <button
              className="archive-btn"
              onClick={() => setShowArchiveModal(true)}
              title="Просмотр архивных документов"
            >
              📦 Архив ({archivedDocuments.length})
            </button>
          </div>
        )}

        {/* Info */}
        <div className="info-section">
          <div className="panel-subtitle">Подсказки</div>
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
          <span className="docs-count">{activeDocuments.length} файлов</span>
          <button
            className="header-archive-btn"
            onClick={() => setShowArchiveModal(true)}
          >
            📦 Архив ({archivedDocuments.length})
          </button>
          {canEdit && (
            <button
              className="header-upload-btn"
              onClick={openUploadModal}
              disabled={uploading}
            >
              {uploading ? <span className="spinner-sm"></span> : '📁'} Загрузить
            </button>
          )}
        </header>

        <div className="docs-content">
          <StorageBar stats={storageStats} loading={!storageStats} />

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <span>Загрузка документов...</span>
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
                  {activeDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-row">
                        <div className="empty-row-content">
                          <span className="empty-icon-small">📂</span>
                          <span>Нет документов. Загрузите первый документ.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeDocuments.map((doc) => (
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
                          <div className="doc-meta">{doc.file_type?.toUpperCase()} | {formatFileSize(doc.file_size)}</div>
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
                        <td>
                          <div className="status-badges">
                            {getStatusBadge(doc)}
                            {getRagStatusBadge(doc)}
                          </div>
                        </td>
                        <td className="actions-cell">
                          {/* 1. Карточка */}
                          <button
                            className="action-btn-icon"
                            onClick={() => openCardModal(doc)}
                            title="Карточка документа"
                          >
                            📋
                          </button>

                          {/* 2. Просмотр */}
                          <button
                            className="action-btn-icon"
                            onClick={() => handleView(doc)}
                            title="Открыть файл"
                          >
                            👁
                          </button>

                          {/* 3. Скачать */}
                          <button
                            className="action-btn-icon"
                            onClick={() => handleDownload(doc)}
                            title="Скачать файл"
                          >
                            ⬇️
                          </button>

                          {/* 4. В архив */}
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

                          {/* 5. Удалить */}
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
                    ))
                  )}
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
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setShowUploadModal(false)}>Отмена</button>
                <button className="btn-primary" onClick={confirmUpload}>Выбрать файл</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Card Modal */}
      {cardDoc && (
        <div className="modal-overlay" onClick={closeCardModal}>
          <div className="modal modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{cardEditMode ? 'Редактирование документа' : 'Карточка документа'}</h3>
              <button className="close-btn" onClick={closeCardModal}>✕</button>
            </div>
            <div className="modal-body">
              {cardEditMode ? (
                /* Edit Mode */
                <div className="card-edit-form">
                  <div className="form-field">
                    <label>Название</label>
                    <input
                      type="text"
                      value={cardTitle}
                      onChange={(e) => setCardTitle(e.target.value)}
                      className="input-light"
                      placeholder="Введите название"
                    />
                  </div>
                  <div className="form-field">
                    <label>Категория</label>
                    <select
                      value={cardCategory}
                      onChange={(e) => setCardCategory(e.target.value)}
                      className="select-light"
                    >
                      {DOC_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Описание</label>
                    <textarea
                      value={cardDescription}
                      onChange={(e) => setCardDescription(e.target.value)}
                      className="textarea-light"
                      placeholder="Введите описание документа"
                      rows={3}
                    />
                  </div>

                  <div className="card-info-readonly">
                    <div className="card-row">
                      <span className="card-label">Файл:</span>
                      <span className="card-value">{cardDoc.original_filename}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Формат:</span>
                      <span className="card-value">{cardDoc.file_type?.toUpperCase()}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Размер:</span>
                      <span className="card-value">{formatFileSize(cardDoc.file_size)}</span>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setCardEditMode(false)}>Отмена</button>
                    <button
                      className="btn-primary"
                      onClick={handleCardSave}
                      disabled={cardSaving || !cardTitle.trim()}
                    >
                      {cardSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="card-section">
                    <div className="card-row">
                      <span className="card-label">Название:</span>
                      <span className="card-value">{cardDoc.title || cardDoc.original_filename}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Файл:</span>
                      <span className="card-value">{cardDoc.original_filename}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Категория:</span>
                      <span className="card-value">{getTypeLabel(cardDoc.document_type)}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Формат:</span>
                      <span className="card-value">{cardDoc.file_type?.toUpperCase()}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Размер:</span>
                      <span className="card-value">{formatFileSize(cardDoc.file_size)}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Статус:</span>
                      <span className="card-value">{getStatusBadge(cardDoc)}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Загружен:</span>
                      <span className="card-value">{new Date(cardDoc.created_at).toLocaleString('ru')}</span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button className="btn-secondary" onClick={() => handleDownload(cardDoc)}>
                      ⬇️ Скачать
                    </button>
                    {canEditEntity(cardDoc.created_by_id) && (
                      <button className="btn-secondary" onClick={() => setCardEditMode(true)}>
                        ✏️ Редактировать
                      </button>
                    )}
                    <button className="btn-cancel" onClick={closeCardModal}>Закрыть</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="modal-overlay" onClick={() => setShowArchiveModal(false)}>
          <div className="modal modal-archive" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 Архив документов</h3>
              <button className="close-btn" onClick={() => setShowArchiveModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Archive Storage Bar */}
              {archiveStats && (
                <div
                  className="archive-storage-bar"
                  style={{ background: getStorageBgColor(archiveStats.usage_percent) }}
                >
                  <div className="archive-storage-header">
                    <span>Хранилище архива</span>
                    <span style={{ color: getStorageColor(archiveStats.usage_percent), fontWeight: 600 }}>
                      {formatGb(archiveStats.total_bytes)} ГБ из {archiveStats.limit_gb} ГБ
                    </span>
                  </div>
                  <div className="archive-storage-track">
                    <div
                      className="archive-storage-fill"
                      style={{
                        width: `${Math.min(archiveStats.usage_percent, 100)}%`,
                        background: getStorageColor(archiveStats.usage_percent)
                      }}
                    />
                  </div>
                  <div className="archive-storage-footer">
                    <span>Осталось: {formatGb(archiveStats.remaining_bytes)} ГБ</span>
                    <span style={{ color: getStorageColor(archiveStats.usage_percent), fontWeight: 600 }}>
                      {archiveStats.usage_percent.toFixed(2)}%
                    </span>
                  </div>
                  {archiveStats.usage_percent >= 80 && (
                    <div className="archive-storage-warning" style={{ color: getStorageColor(archiveStats.usage_percent) }}>
                      {archiveStats.usage_percent >= 95
                        ? '⚠️ Архив почти заполнен! Удалите или восстановите документы.'
                        : '⚠️ Архив заполняется. Рекомендуем освободить место.'}
                    </div>
                  )}
                </div>
              )}

              {archivedDocuments.length === 0 ? (
                <div className="archive-empty">
                  <span className="empty-icon-small">📭</span>
                  <p>Архив пуст</p>
                </div>
              ) : (
                <div className="archive-list">
                  {archivedDocuments.map((doc) => (
                    <div key={doc.id} className="archive-item">
                      <div className="archive-item-info">
                        <div className="archive-item-title">{doc.title || doc.original_filename}</div>
                        <div className="archive-item-meta">
                          {doc.file_type?.toUpperCase()} • {formatFileSize(doc.file_size)} • {getTypeLabel(doc.document_type)}
                        </div>
                      </div>
                      <div className="archive-item-actions">
                        {canEditEntity(doc.created_by_id) ? (
                          <>
                            <button
                              className="btn-restore"
                              onClick={() => handleRestore(doc)}
                              disabled={processing === doc.id}
                              title="Восстановить в основной реестр"
                            >
                              {processing === doc.id ? '...' : '↩️ Восстановить'}
                            </button>
                            <button
                              className="btn-archive-delete"
                              onClick={() => handleDeleteFromArchive(doc)}
                              disabled={processing === doc.id}
                              title="Удалить документ"
                            >
                              🗑️
                            </button>
                          </>
                        ) : (
                          <span className="no-access-hint">Нет прав</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowArchiveModal(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirm Modal */}
      {archiveConfirmDoc && (
        <div className="modal-overlay" onClick={() => setArchiveConfirmDoc(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Перенос в архив</h3>
              <button className="close-btn" onClick={() => setArchiveConfirmDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-doc-name">{archiveConfirmDoc.title || archiveConfirmDoc.original_filename}</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                Размер: {formatFileSize(archiveConfirmDoc.file_size)}
              </p>

              {archiveStats && (
                <div
                  className="archive-confirm-stats"
                  style={{ background: getStorageBgColor(getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0)) }}
                >
                  <div className="archive-confirm-row">
                    <span>Текущее заполнение архива:</span>
                    <span style={{ fontWeight: 600, color: getStorageColor(archiveStats.usage_percent) }}>
                      {formatGb(archiveStats.total_bytes)} ГБ ({archiveStats.usage_percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="archive-confirm-row">
                    <span>После переноса:</span>
                    <span style={{ fontWeight: 600, color: getStorageColor(getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0)) }}>
                      {formatGb(archiveStats.total_bytes + (archiveConfirmDoc.file_size || 0))} ГБ ({getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0).toFixed(1)}%)
                    </span>
                  </div>
                  {getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0) >= 80 && (
                    <div
                      className="archive-confirm-warning"
                      style={{ color: getStorageColor(getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0)) }}
                    >
                      {getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0) >= 100
                        ? '❌ Недостаточно места в архиве!'
                        : getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0) >= 95
                          ? '⚠️ Архив будет почти заполнен!'
                          : '⚠️ Архив заполняется.'}
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setArchiveConfirmDoc(null)}>Отмена</button>
                <button
                  className="btn-primary"
                  onClick={confirmArchive}
                  disabled={archiveStats ? getArchiveUsageAfterAdd(archiveConfirmDoc.file_size || 0) >= 100 : false}
                >
                  Переместить в архив
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModal && (
        <ErrorModal
          isOpen={!!errorModal}
          onClose={() => setErrorModal(null)}
          title={errorModal.title}
          message={errorModal.message}
          type={errorModal.type}
        />
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
          margin-bottom: 12px;
        }
        .archive-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 8px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          color: #aaa;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .archive-btn:hover {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }
        .upload-hint-old {
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
          flex: 1;
        }

        .header-archive-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #374151;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .header-archive-btn:hover {
          background: #e5e7eb;
        }
        .header-upload-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--primary);
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .header-upload-btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        .header-upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .empty-row td {
          padding: 48px 16px !important;
        }
        .empty-row-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
        }
        .empty-icon-small {
          font-size: 32px;
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

        /* Card Modal */
        .modal-card {
          max-width: 480px;
        }
        .card-section {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .card-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .card-row:last-child {
          border-bottom: none;
        }
        .card-label {
          font-size: 13px;
          color: var(--text-muted);
          min-width: 120px;
        }
        .card-value {
          font-size: 13px;
          font-weight: 500;
          text-align: right;
          word-break: break-word;
          max-width: 60%;
        }
        .card-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .btn-secondary {
          padding: 8px 14px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: #2563eb;
        }

        /* Card Edit Mode */
        .card-edit-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .textarea-light {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          min-height: 80px;
        }
        .textarea-light:focus {
          outline: none;
          border-color: var(--primary);
        }
        .card-info-readonly {
          background: #f9fafb;
          border-radius: 8px;
          padding: 12px;
          margin-top: 8px;
        }
        .card-info-readonly .card-row {
          padding: 6px 0;
        }
        .card-info-readonly .card-label {
          font-size: 12px;
        }
        .card-info-readonly .card-value {
          font-size: 12px;
        }

        /* Archive Modal */
        .modal-archive {
          max-width: 520px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }
        .modal-archive .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }
        .modal-footer {
          padding: 12px 20px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
        }
        .archive-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px;
          color: var(--text-muted);
        }
        .archive-empty p {
          margin: 8px 0 0;
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
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .archive-item-info {
          flex: 1;
          min-width: 0;
        }
        .archive-item-title {
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .archive-item-meta {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .archive-item-actions {
          flex-shrink: 0;
        }
        .btn-restore {
          padding: 6px 12px;
          background: #10b981;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-restore:hover:not(:disabled) {
          background: #059669;
        }
        .btn-restore:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-archive-delete {
          padding: 6px 10px;
          background: #fee2e2;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-archive-delete:hover:not(:disabled) {
          background: #fecaca;
        }
        .btn-archive-delete:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .no-access-hint {
          font-size: 11px;
          color: var(--text-muted);
          font-style: italic;
        }

        /* Archive Storage Bar */
        .archive-storage-bar {
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
        }
        .archive-storage-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 8px;
        }
        .archive-storage-track {
          height: 8px;
          background: rgba(255, 255, 255, 0.8);
          border-radius: 4px;
          overflow: hidden;
        }
        .archive-storage-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .archive-storage-footer {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-top: 6px;
          color: #6b7280;
        }
        .archive-storage-warning {
          margin-top: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        /* Archive Confirm Modal */
        .archive-confirm-stats {
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
        }
        .archive-confirm-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 6px 0;
        }
        .archive-confirm-row:first-child {
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }
        .archive-confirm-warning {
          margin-top: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
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
