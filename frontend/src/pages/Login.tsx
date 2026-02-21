import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    return () => clearError()
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await login({ username, password })
    if (success) {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          {/* Logo & Branding */}
          <div className="login-header">
            <div className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="logo-text">NPF Development</span>
            </div>
            <p className="login-subtitle">Система управления корпоративным блоком НПФ</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Имя пользователя</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                </svg>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введите логин"
                  required
                  disabled={isLoading}
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                </svg>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <svg className="spinner" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                      <animate attributeName="stroke-dashoffset" values="32;0;32" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                  <span>Вход в систему...</span>
                </>
              ) : (
                <>
                  <span>Войти</span>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="login-footer">
            <p>Корпоративная система планирования НПФ</p>
          </div>
        </div>

        <p className="copyright">&copy; 2026 NPF Development</p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .login-container {
          width: 100%;
          max-width: 420px;
        }

        .login-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .login-header {
          padding: 32px 32px 24px;
          text-align: center;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 1px solid #e2e8f0;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .logo-icon svg {
          width: 24px;
          height: 24px;
        }

        .logo-text {
          font-size: 22px;
          font-weight: 700;
          color: #1e293b;
        }

        .login-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .login-form {
          padding: 32px;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          color: #dc2626;
          font-size: 13px;
          margin-bottom: 24px;
        }

        .error-message svg {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }

        .input-wrapper {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: #9ca3af;
          pointer-events: none;
        }

        .form-group input {
          width: 100%;
          padding: 12px 14px 12px 44px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          color: #1e293b;
          background: white;
          transition: all 0.2s;
        }

        .form-group input::placeholder {
          color: #9ca3af;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
        }

        .form-group input:disabled {
          background: #f8fafc;
          cursor: not-allowed;
        }

        .login-button {
          width: 100%;
          padding: 14px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px -10px rgba(102, 126, 234, 0.5);
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-button svg {
          width: 18px;
          height: 18px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          opacity: 0.9;
        }

        .login-footer {
          padding: 16px 32px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          text-align: center;
        }

        .login-footer p {
          margin: 0;
          font-size: 12px;
          color: #94a3b8;
        }

        .copyright {
          text-align: center;
          margin-top: 24px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }

        @media (max-width: 480px) {
          .login-header {
            padding: 24px 24px 20px;
          }

          .login-form {
            padding: 24px;
          }

          .logo-text {
            font-size: 18px;
          }

          .login-subtitle {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  )
}
