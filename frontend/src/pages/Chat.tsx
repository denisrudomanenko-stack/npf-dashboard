import { useState, useRef, useEffect } from 'react'
import { api } from '../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await api.post('/rag/chat', [...messages, userMessage])
      setMessages(prev => [...prev, response.data])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Произошла ошибка. Попробуйте позже.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat">
      <div className="page-header">
        <h2>AI Ассистент</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Задавайте вопросы по НПО, КПП, ПДС и базе знаний
        </p>
      </div>

      <div className="chat-container card">
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h3>Добро пожаловать!</h3>
              <p>Я AI-ассистент для работы с НПФ. Могу помочь с:</p>
              <ul>
                <li>Вопросами по корпоративным пенсионным программам</li>
                <li>Информацией о ПДС (Программа долгосрочных сбережений)</li>
                <li>Поиском в загруженных документах</li>
                <li>Консультациями по стратегии развития</li>
              </ul>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="message-content typing">Думаю...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Введите вопрос..."
            rows={2}
          />
          <button
            className="btn btn-primary send-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Отправить
          </button>
        </div>
      </div>

      <style>{`
        .chat {
          height: calc(100vh - 200px);
          display: flex;
          flex-direction: column;
        }
        .page-header {
          margin-bottom: 1rem;
        }
        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }
        .welcome-message {
          color: var(--text-muted);
          padding: 2rem;
          text-align: center;
        }
        .welcome-message h3 {
          color: var(--text);
          margin-bottom: 1rem;
        }
        .welcome-message ul {
          text-align: left;
          max-width: 400px;
          margin: 1rem auto 0;
        }
        .welcome-message li {
          margin-bottom: 0.5rem;
        }
        .message {
          margin-bottom: 1rem;
          display: flex;
        }
        .message.user {
          justify-content: flex-end;
        }
        .message-content {
          max-width: 70%;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          line-height: 1.5;
        }
        .message.user .message-content {
          background: var(--primary);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .message.assistant .message-content {
          background: var(--background);
          border-bottom-left-radius: 4px;
        }
        .typing {
          color: var(--text-muted);
        }
        .input-area {
          display: flex;
          gap: 0.5rem;
          padding: 1rem;
          border-top: 1px solid var(--border);
        }
        .input-area textarea {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          resize: none;
          font-family: inherit;
        }
        .input-area textarea:focus {
          outline: none;
          border-color: var(--primary);
        }
        .send-btn {
          align-self: flex-end;
        }
      `}</style>
    </div>
  )
}

export default Chat
