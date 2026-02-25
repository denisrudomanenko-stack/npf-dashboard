import { useState, useRef, useEffect } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'

interface Message {
  id?: number
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface Conversation {
  id: number
  title: string | null
  created_at: string
  updated_at: string
  message_count: number
  last_message: string | null
  user_id: number | null
  username: string | null
  has_rag: boolean
}

interface LLMConfig {
  ollama_available: boolean
  anthropic_configured: boolean
  timeweb_available: boolean
  chat: { provider: string; model: string }
  vision: { provider: string; model: string }
  embeddings: { provider: string; model: string }
  available_ollama_models: string[]
  anthropic_models: string[]
  timeweb_models: string[]
}

function Chat() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null)
  const [configModal, setConfigModal] = useState<'chat' | 'vision' | 'embeddings' | null>(null)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [useRag, setUseRag] = useState(true)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadLLMConfig()
    loadConversations()
  }, [])

  const loadLLMConfig = async () => {
    try {
      const response = await api.get('/rag/llm-config')
      setLlmConfig(response.data)
    } catch (error) {
      console.error('Failed to load LLM config:', error)
    }
  }

  const loadConversations = async () => {
    setConversationsLoading(true)
    try {
      const response = await api.get('/conversations/')
      setConversations(response.data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setConversationsLoading(false)
    }
  }

  const loadConversation = async (conversationId: number) => {
    try {
      const response = await api.get(`/conversations/${conversationId}`)
      setMessages(response.data.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at
      })))
      setCurrentConversation(conversationId)
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const createNewConversation = async () => {
    try {
      const response = await api.post('/conversations/', {})
      const newConv = response.data
      setConversations(prev => [newConv, ...prev])
      setCurrentConversation(newConv.id)
      setMessages([])
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Удалить эту беседу?')) return

    try {
      await api.delete(`/conversations/${id}`)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (currentConversation === id) {
        setCurrentConversation(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const openConfigModal = (category: 'chat' | 'vision' | 'embeddings') => {
    if (!llmConfig) return
    setSelectedProvider(llmConfig[category].provider)
    setSelectedModel(llmConfig[category].model)
    setConfigModal(category)
  }

  const saveConfig = async () => {
    if (!configModal) return
    try {
      const formData = new FormData()
      formData.append('category', configModal)
      formData.append('provider', selectedProvider)
      formData.append('model', selectedModel)
      await api.post('/rag/llm-config', formData)
      loadLLMConfig()
      setConfigModal(null)
    } catch (error) {
      console.error('Failed to update config:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    // Create conversation if none selected
    let convId = currentConversation
    if (!convId) {
      try {
        const response = await api.post('/conversations/', {})
        convId = response.data.id
        setCurrentConversation(convId)
        setConversations(prev => [response.data, ...prev])
      } catch (error) {
        console.error('Failed to create conversation:', error)
        return
      }
    }

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await api.post(`/conversations/${convId}/chat`, {
        content: input,
        use_rag: useRag
      })

      // Update messages with response
      setMessages(prev => {
        const updated = [...prev]
        // Update user message with ID
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          id: response.data.user_message.id
        }
        // Add assistant message
        updated.push({
          id: response.data.assistant_message.id,
          role: 'assistant',
          content: response.data.assistant_message.content
        })
        return updated
      })

      // Refresh conversations list to update title and last message
      loadConversations()
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Произошла ошибка. Попробуйте позже.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const getModelsForProvider = (provider: string, category: string) => {
    if (!llmConfig) return []
    if (provider === 'timeweb') {
      return llmConfig.timeweb_models
    }
    if (provider === 'ollama') {
      return category === 'embeddings'
        ? llmConfig.available_ollama_models.filter(m => m.includes('embed'))
        : llmConfig.available_ollama_models.filter(m => !m.includes('embed'))
    }
    return llmConfig.anthropic_models
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Сегодня'
    if (days === 1) return 'Вчера'
    if (days < 7) return `${days} дн. назад`
    return date.toLocaleDateString('ru')
  }

  return (
    <div className="chat-wrapper">
      {/* Left Sidebar - Conversations */}
      <aside className="conversations-panel">
        <div className="panel-header">
          <span className="panel-title">Беседы</span>
          <button
            className="btn-new-chat"
            onClick={createNewConversation}
            title="Начать новую беседу"
          >
            + Новая
          </button>
        </div>

        <div className="conversations-list">
          {conversationsLoading ? (
            <div className="loading-text">Загрузка...</div>
          ) : conversations.length === 0 ? (
            <div className="empty-conversations">
              <p>Нет сохранённых бесед</p>
              <p className="hint">Начните новую беседу</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${currentConversation === conv.id ? 'active' : ''}`}
                onClick={() => loadConversation(conv.id)}
                title={conv.title || 'Без названия'}
              >
                <div className="conv-content">
                  <div className="conv-title-row">
                    <span className="conv-title">{conv.title || 'Новая беседа'}</span>
                    {conv.has_rag && <span className="rag-badge" title="Использовался RAG">RAG</span>}
                  </div>
                  <div className="conv-meta">
                    {isAdmin && conv.username && (
                      <span className="conv-user">@{conv.username}</span>
                    )}
                    <span>{formatDate(conv.updated_at)}</span>
                    <span>• {conv.message_count} сообщ.</span>
                  </div>
                </div>
                <button
                  className="conv-delete"
                  onClick={(e) => deleteConversation(conv.id, e)}
                  title="Удалить беседу"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* LLM Config */}
        {llmConfig && (
          <div className="llm-section">
            <div className="llm-section-title">Настройки LLM</div>
            <div className="model-card" onClick={() => openConfigModal('chat')}>
              <div className="mc-header">
                <span className="mc-icon">💬</span>
                <span className="mc-label">Чат</span>
                <span className="mc-provider">{llmConfig.chat.provider}</span>
              </div>
              <div className="mc-model">{llmConfig.chat.model.replace('deepseek-', '').replace('claude-', '').substring(0, 15)}</div>
            </div>
            <div className="model-card" onClick={() => openConfigModal('vision')}>
              <div className="mc-header">
                <span className="mc-icon">👁</span>
                <span className="mc-label">OCR</span>
                <span className="mc-provider">{llmConfig.vision.provider}</span>
              </div>
              <div className="mc-model">{llmConfig.vision.model.replace('claude-', '').substring(0, 12)}</div>
            </div>
            <div className="model-card" onClick={() => openConfigModal('embeddings')}>
              <div className="mc-header">
                <span className="mc-icon">🔍</span>
                <span className="mc-label">Embed</span>
                <span className="mc-provider">{llmConfig.embeddings.provider}</span>
              </div>
              <div className="mc-model">{llmConfig.embeddings.model}</div>
            </div>
            <div className="status-row">
              <span className={`status-chip ${llmConfig.timeweb_available ? 'online' : 'offline'}`} title="Timeweb Cloud AI (DeepSeek)">
                TW {llmConfig.timeweb_available ? '●' : '○'}
              </span>
              <span className={`status-chip ${llmConfig.ollama_available ? 'online' : 'offline'}`} title="Ollama (локальный)">
                OL {llmConfig.ollama_available ? '●' : '○'}
              </span>
              <span className={`status-chip ${llmConfig.anthropic_configured ? 'online' : 'offline'}`} title="Anthropic Claude">
                CL {llmConfig.anthropic_configured ? '●' : '○'}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        <header className="chat-header">
          <h1>AI Ассистент</h1>
          <div className="header-actions">
            <div
              className="rag-toggle"
              onClick={() => setUseRag(!useRag)}
              title={useRag ? 'RAG включён: ответы на основе базы знаний' : 'RAG выключен: общие знания модели'}
            >
              <div className={`toggle-switch ${useRag ? 'on' : 'off'}`}>
                <div className="toggle-knob"></div>
              </div>
              <span className="toggle-label">RAG</span>
            </div>
          </div>
        </header>

        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <h2>Добро пожаловать!</h2>
              <p>Я AI-ассистент для работы с НПФ. Задайте вопрос:</p>
              <div className="suggestions">
                <button onClick={() => setInput('Что такое КПП и как это работает?')}>Что такое КПП?</button>
                <button onClick={() => setInput('Расскажи о программе ПДС')}>Программа ПДС</button>
                <button onClick={() => setInput('Какие документы есть в базе знаний?')}>База знаний</button>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((msg, i) => (
                <div key={msg.id || i} className={`msg ${msg.role}`}>
                  <div className="msg-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                  <div className="msg-content">{msg.content}</div>
                </div>
              ))}
              {loading && (
                <div className="msg assistant">
                  <div className="msg-avatar">🤖</div>
                  <div className="msg-content typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <footer className="input-footer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Введите сообщение... (Enter для отправки)"
            rows={1}
          />
          <button
            className="btn-send"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            {loading ? '...' : '➤'}
          </button>
        </footer>
      </main>

      {/* Config Modal */}
      {configModal && llmConfig && (
        <div className="modal-backdrop" onClick={() => setConfigModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <span>
                {configModal === 'chat' ? '💬 Чат' : configModal === 'vision' ? '👁 Vision' : '🔍 Embeddings'}
              </span>
              <button onClick={() => setConfigModal(null)}>✕</button>
            </div>
            <div className="modal-content">
              <div className="form-field">
                <label>Провайдер</label>
                <div className="provider-buttons">
                  {configModal === 'chat' ? (
                    <>
                      {llmConfig.timeweb_available && (
                        <button
                          className={`provider-btn ${selectedProvider === 'timeweb' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedProvider('timeweb')
                            if (llmConfig.timeweb_models.length > 0) setSelectedModel(llmConfig.timeweb_models[0])
                          }}
                          title="Timeweb Cloud AI"
                        >
                          🚀 Timeweb
                        </button>
                      )}
                      {llmConfig.ollama_available && (
                        <button
                          className={`provider-btn ${selectedProvider === 'ollama' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedProvider('ollama')
                            const models = llmConfig.available_ollama_models.filter(m => !m.includes('embed'))
                            if (models.length > 0) setSelectedModel(models[0])
                          }}
                          title="Локальный Ollama"
                        >
                          🖥 Ollama
                        </button>
                      )}
                      {llmConfig.anthropic_configured && (
                        <button
                          className={`provider-btn ${selectedProvider === 'anthropic' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedProvider('anthropic')
                            setSelectedModel(llmConfig.anthropic_models[0])
                          }}
                          title="Anthropic Claude"
                        >
                          ☁️ Claude
                        </button>
                      )}
                    </>
                  ) : (
                    <button className="provider-btn active" disabled>
                      {configModal === 'vision' ? '☁️ Claude' : '🖥 Ollama'}
                    </button>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label>Модель</label>
                <div className="model-list-select">
                  {getModelsForProvider(selectedProvider, configModal).map(m => (
                    <button
                      key={m}
                      className={`model-option ${selectedModel === m ? 'active' : ''}`}
                      onClick={() => setSelectedModel(m)}
                    >
                      {m} {selectedModel === m && '✓'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-buttons">
                <button className="btn-cancel" onClick={() => setConfigModal(null)}>Отмена</button>
                <button className="btn-save" onClick={saveConfig}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .chat-wrapper {
          position: fixed;
          top: 73px;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          background: var(--background);
        }

        /* Left Panel - Conversations */
        .conversations-panel {
          width: 280px;
          background: #1a1a2e;
          color: #fff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .panel-title {
          font-size: 14px;
          font-weight: 600;
        }
        .btn-new-chat {
          background: var(--primary);
          border: none;
          color: #fff;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-new-chat:hover {
          opacity: 0.9;
        }

        .conversations-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .conversation-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 4px;
        }
        .conversation-item:hover {
          background: rgba(255,255,255,0.08);
        }
        .conversation-item.active {
          background: rgba(255,255,255,0.12);
        }
        .conv-content {
          flex: 1;
          min-width: 0;
        }
        .conv-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 2px;
        }
        .conv-title {
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .rag-badge {
          font-size: 9px;
          padding: 2px 5px;
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border-radius: 3px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .conv-meta {
          font-size: 11px;
          color: #888;
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .conv-user {
          color: #a5b4fc;
          font-weight: 500;
        }
        .conv-user::after {
          content: '•';
          margin-left: 4px;
        }
        .conv-delete {
          background: none;
          border: none;
          color: #666;
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .conversation-item:hover .conv-delete {
          opacity: 1;
        }
        .conv-delete:hover {
          color: #f87171;
        }

        .empty-conversations {
          text-align: center;
          padding: 32px 16px;
          color: #666;
        }
        .empty-conversations .hint {
          font-size: 12px;
          margin-top: 8px;
        }
        .loading-text {
          text-align: center;
          padding: 20px;
          color: #666;
        }

        /* LLM Section */
        .llm-section {
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .llm-section-title {
          font-size: 11px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
        }
        .model-card {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
          margin-bottom: 6px;
        }
        .model-card:hover {
          background: rgba(255,255,255,0.1);
        }
        .mc-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .mc-icon { font-size: 12px; }
        .mc-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #888;
          flex: 1;
        }
        .mc-provider {
          font-size: 9px;
          padding: 2px 5px;
          border-radius: 3px;
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          text-transform: uppercase;
        }
        .mc-model {
          font-size: 11px;
          color: #ccc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status-row {
          display: flex;
          gap: 4px;
          margin-top: 10px;
          justify-content: center;
        }
        .status-chip {
          font-size: 9px;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(255,255,255,0.05);
          cursor: help;
          font-weight: 500;
        }
        .status-chip.online {
          color: #4ade80;
          background: rgba(74, 222, 128, 0.1);
        }
        .status-chip.offline {
          color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        /* Main Chat */
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: #fff;
          border-bottom: 1px solid var(--border);
        }
        .chat-header h1 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* RAG Toggle */
        .rag-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .rag-toggle:hover {
          background: #f5f5f5;
        }
        .toggle-switch {
          width: 36px;
          height: 20px;
          border-radius: 10px;
          position: relative;
          transition: background 0.2s;
        }
        .toggle-switch.on { background: #22c55e; }
        .toggle-switch.off { background: #d1d5db; }
        .toggle-knob {
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          transition: left 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .toggle-switch.on .toggle-knob { left: 18px; }
        .toggle-switch.off .toggle-knob { left: 2px; }
        .toggle-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }

        /* Messages */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--text-muted);
        }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .empty-state h2 { font-size: 20px; margin: 0 0 8px; color: var(--text); }
        .empty-state p { margin: 0 0 20px; }
        .suggestions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .suggestions button {
          background: #fff;
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
        }
        .suggestions button:hover {
          border-color: var(--primary);
          color: var(--primary);
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .msg {
          display: flex;
          gap: 12px;
          max-width: 85%;
        }
        .msg.user {
          flex-direction: row-reverse;
          margin-left: auto;
        }
        .msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .msg.user .msg-avatar { background: var(--primary); }
        .msg-content {
          background: #fff;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .msg.user .msg-content {
          background: var(--primary);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .msg.assistant .msg-content {
          border-bottom-left-radius: 4px;
        }
        .typing {
          display: flex;
          gap: 4px;
          padding: 12px 20px;
        }
        .typing span {
          width: 8px;
          height: 8px;
          background: #ccc;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing span:nth-child(1) { animation-delay: -0.32s; }
        .typing span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        /* Input */
        .input-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          background: #fff;
          border-top: 1px solid var(--border);
        }
        .input-footer textarea {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: 24px;
          resize: none;
          font-family: inherit;
          font-size: 14px;
          max-height: 120px;
        }
        .input-footer textarea:focus {
          outline: none;
          border-color: var(--primary);
        }
        .btn-send {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: var(--primary);
          color: #fff;
          font-size: 18px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .btn-send:hover:not(:disabled) { transform: scale(1.05); }
        .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

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
          background: #fff;
          border-radius: 12px;
          width: 380px;
          max-height: 80vh;
          overflow: hidden;
        }
        .modal-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          font-weight: 600;
          border-bottom: 1px solid var(--border);
        }
        .modal-title button {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: var(--text-muted);
        }
        .modal-content {
          padding: 20px;
        }
        .form-field {
          margin-bottom: 16px;
        }
        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--text-muted);
        }
        .provider-buttons {
          display: flex;
          gap: 8px;
        }
        .provider-btn {
          flex: 1;
          padding: 10px;
          border: 2px solid var(--border);
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          font-size: 13px;
        }
        .provider-btn:hover:not(:disabled) {
          border-color: var(--primary);
        }
        .provider-btn.active {
          border-color: var(--primary);
          background: #f0f4ff;
        }
        .provider-btn:disabled {
          opacity: 0.7;
        }
        .model-list-select {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 4px;
        }
        .model-option {
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          text-align: left;
          font-size: 13px;
        }
        .model-option:hover {
          background: #f5f5f5;
        }
        .model-option.active {
          background: #e0e7ff;
        }
        .modal-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 16px;
        }
        .btn-cancel, .btn-save {
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-cancel {
          background: none;
          border: 1px solid var(--border);
        }
        .btn-save {
          background: var(--primary);
          color: #fff;
          border: none;
        }
      `}</style>
    </div>
  )
}

export default Chat
