import { useState, useEffect } from 'react'
import { usePermissions } from '../hooks/usePermissions'

interface LLMConfig {
  ollama_available: boolean
  anthropic_configured: boolean
  chat: { provider: string; model: string }
  vision: { provider: string; model: string }
  embeddings: { provider: string; model: string }
  available_ollama_models: string[]
  anthropic_models: string[]
}

const API_BASE = '/api/v1/rag'

export default function LLMSettings() {
  const { isAdmin } = usePermissions()
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/llm-config`)
      if (!res.ok) throw new Error('Failed to load config')
      const data = await res.json()
      setConfig(data)
    } catch (e) {
      setError('Не удалось загрузить настройки LLM')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function updateConfig(category: string, provider: string, model: string) {
    try {
      setSaving(category)
      setError(null)
      setSuccess(null)

      const formData = new FormData()
      formData.append('category', category)
      formData.append('provider', provider)
      formData.append('model', model)

      const res = await fetch(`${API_BASE}/llm-config`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Failed to save config')

      await loadConfig()
      setSuccess(`Настройки ${category} сохранены`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(`Ошибка сохранения ${category}`)
      console.error(e)
    } finally {
      setSaving(null)
    }
  }

  async function resetConfig(category: string) {
    try {
      setSaving(category)
      setError(null)

      const formData = new FormData()
      formData.append('category', category)

      const res = await fetch(`${API_BASE}/llm-config/reset`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Failed to reset config')

      await loadConfig()
      setSuccess(`Настройки ${category} сброшены`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(`Ошибка сброса ${category}`)
      console.error(e)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Загрузка настроек...</div>
      </div>
    )
  }

  if (!config) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Не удалось загрузить настройки</div>
        <button onClick={loadConfig} style={styles.retryButton}>Повторить</button>
      </div>
    )
  }

  // Read-only view for non-admins
  if (!isAdmin) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Информация об AI</h1>

        {/* Status indicators */}
        <div style={styles.statusRow}>
          <div style={{...styles.statusBadge, ...(config.ollama_available ? styles.statusOk : styles.statusError)}}>
            Ollama: {config.ollama_available ? 'Доступен' : 'Недоступен'}
          </div>
          <div style={{...styles.statusBadge, ...(config.anthropic_configured ? styles.statusOk : styles.statusWarning)}}>
            Anthropic: {config.anthropic_configured ? 'Настроен' : 'Не настроен'}
          </div>
        </div>

        {/* Read-only info cards */}
        <InfoCard
          title="Chat (Чат)"
          description="Модель для генерации ответов в чате"
          provider={config.chat.provider}
          model={config.chat.model}
        />
        <InfoCard
          title="Vision (Зрение)"
          description="Модель для анализа изображений и PDF"
          provider={config.vision.provider}
          model={config.vision.model}
        />
        <InfoCard
          title="Embeddings (Векторизация)"
          description="Модель для создания эмбеддингов документов"
          provider={config.embeddings.provider}
          model={config.embeddings.model}
        />

        <div style={styles.infoNote}>
          💡 Настройки AI доступны только администраторам
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Настройки LLM</h1>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {success && <div style={styles.successBanner}>{success}</div>}

      {/* Status indicators */}
      <div style={styles.statusRow}>
        <div style={{...styles.statusBadge, ...(config.ollama_available ? styles.statusOk : styles.statusError)}}>
          Ollama: {config.ollama_available ? 'Доступен' : 'Недоступен'}
        </div>
        <div style={{...styles.statusBadge, ...(config.anthropic_configured ? styles.statusOk : styles.statusWarning)}}>
          Anthropic: {config.anthropic_configured ? 'Настроен' : 'Не настроен'}
        </div>
      </div>

      {/* Chat model */}
      <ConfigCard
        title="Chat (Чат)"
        description="Модель для генерации ответов в чате"
        currentProvider={config.chat.provider}
        currentModel={config.chat.model}
        ollamaModels={config.available_ollama_models}
        anthropicModels={config.anthropic_models}
        onSave={(provider, model) => updateConfig('chat', provider, model)}
        onReset={() => resetConfig('chat')}
        saving={saving === 'chat'}
        anthropicAvailable={config.anthropic_configured}
      />

      {/* Vision model */}
      <ConfigCard
        title="Vision (Зрение)"
        description="Модель для анализа изображений и PDF"
        currentProvider={config.vision.provider}
        currentModel={config.vision.model}
        ollamaModels={[]}
        anthropicModels={config.anthropic_models}
        onSave={(provider, model) => updateConfig('vision', provider, model)}
        onReset={() => resetConfig('vision')}
        saving={saving === 'vision'}
        anthropicAvailable={config.anthropic_configured}
        visionOnly
      />

      {/* Embeddings model */}
      <ConfigCard
        title="Embeddings (Векторизация)"
        description="Модель для создания эмбеддингов документов"
        currentProvider={config.embeddings.provider}
        currentModel={config.embeddings.model}
        ollamaModels={config.available_ollama_models}
        anthropicModels={[]}
        onSave={(provider, model) => updateConfig('embeddings', provider, model)}
        onReset={() => resetConfig('embeddings')}
        saving={saving === 'embeddings'}
        anthropicAvailable={false}
        embeddingsOnly
      />
    </div>
  )
}

// Read-only info card for non-admin users
interface InfoCardProps {
  title: string
  description: string
  provider: string
  model: string
}

function InfoCard({ title, description, provider, model }: InfoCardProps) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{title}</h3>
        <span style={styles.cardBadge}>{provider}</span>
      </div>
      <p style={styles.cardDescription}>{description}</p>
      <div style={styles.infoRow}>
        <span style={styles.infoLabel}>Модель:</span>
        <span style={styles.infoValue}>{model}</span>
      </div>
    </div>
  )
}

interface ConfigCardProps {
  title: string
  description: string
  currentProvider: string
  currentModel: string
  ollamaModels: string[]
  anthropicModels: string[]
  onSave: (provider: string, model: string) => void
  onReset: () => void
  saving: boolean
  anthropicAvailable: boolean
  visionOnly?: boolean
  embeddingsOnly?: boolean
}

function ConfigCard({
  title,
  description,
  currentProvider,
  currentModel,
  ollamaModels,
  anthropicModels,
  onSave,
  onReset,
  saving,
  anthropicAvailable,
  visionOnly,
  embeddingsOnly
}: ConfigCardProps) {
  const [provider, setProvider] = useState(currentProvider)
  const [model, setModel] = useState(currentModel)

  useEffect(() => {
    setProvider(currentProvider)
    setModel(currentModel)
  }, [currentProvider, currentModel])

  const availableModels = provider === 'ollama' ? ollamaModels : anthropicModels
  const hasChanges = provider !== currentProvider || model !== currentModel

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{title}</h3>
        <span style={styles.cardBadge}>{currentProvider}</span>
      </div>
      <p style={styles.cardDescription}>{description}</p>

      <div style={styles.cardContent}>
        {!visionOnly && !embeddingsOnly && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Провайдер</label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value)
                setModel(e.target.value === 'ollama' ? ollamaModels[0] || '' : anthropicModels[0] || '')
              }}
              style={styles.select}
              disabled={saving}
            >
              <option value="ollama">Ollama (локально)</option>
              {anthropicAvailable && <option value="anthropic">Anthropic Claude</option>}
            </select>
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>Модель</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={styles.select}
            disabled={saving}
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.cardActions}>
        <button
          onClick={() => onSave(provider, model)}
          disabled={saving || !hasChanges}
          style={{
            ...styles.saveButton,
            opacity: (saving || !hasChanges) ? 0.5 : 1
          }}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          onClick={onReset}
          disabled={saving}
          style={styles.resetButton}
        >
          Сбросить
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto'
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    marginBottom: '24px',
    color: '#1a1a2e'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#666'
  },
  error: {
    textAlign: 'center',
    padding: '48px',
    color: '#dc2626'
  },
  retryButton: {
    display: 'block',
    margin: '16px auto',
    padding: '12px 24px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  errorBanner: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    marginBottom: '16px'
  },
  successBanner: {
    padding: '12px 16px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    color: '#16a34a',
    marginBottom: '16px'
  },
  statusRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  },
  statusBadge: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500
  },
  statusOk: {
    background: '#dcfce7',
    color: '#16a34a'
  },
  statusWarning: {
    background: '#fef3c7',
    color: '#d97706'
  },
  statusError: {
    background: '#fef2f2',
    color: '#dc2626'
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
    color: '#1a1a2e'
  },
  cardBadge: {
    padding: '4px 12px',
    background: '#e0e7ff',
    color: '#4f46e5',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'uppercase'
  },
  cardDescription: {
    color: '#6b7280',
    fontSize: '14px',
    marginBottom: '16px'
  },
  cardContent: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  },
  formGroup: {
    flex: '1 1 200px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer'
  },
  cardActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #f3f4f6'
  },
  saveButton: {
    padding: '10px 20px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px'
  },
  resetButton: {
    padding: '10px 20px',
    background: 'white',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px'
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: '#f9fafb',
    borderRadius: '8px'
  },
  infoLabel: {
    color: '#6b7280',
    fontSize: '14px'
  },
  infoValue: {
    color: '#1f2937',
    fontSize: '14px',
    fontWeight: 500
  },
  infoNote: {
    marginTop: '24px',
    padding: '16px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '12px',
    color: '#92400e',
    fontSize: '14px',
    textAlign: 'center'
  }
}
