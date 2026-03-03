import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  sales: 'Продавец',
  viewer: 'Просмотр',
}

export default function UserMenu() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="user-avatar">
          {user.username.charAt(0).toUpperCase()}
        </span>
        <span className="user-name">{user.username}</span>
        <svg
          className={`chevron ${isOpen ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-info">
            <div className="user-info-name">{user.username}</div>
            <div className="user-info-email">{user.email}</div>
            <div className="user-info-role">{roleLabels[user.role]}</div>
          </div>

          <div className="menu-divider" />

          {user.role === 'admin' && (
            <>
              <button
                className="menu-item"
                onClick={() => {
                  setIsOpen(false)
                  navigate('/users')
                }}
              >
                Пользователи
              </button>
              <div className="menu-divider" />
            </>
          )}

          <button className="menu-item menu-item-danger" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      )}

      <style>{`
        .user-menu {
          position: relative;
        }

        .user-menu-trigger {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 0.5rem;
          color: white;
          cursor: pointer;
          transition: background 0.2s;
        }

        .user-menu-trigger:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .user-avatar {
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .chevron {
          transition: transform 0.2s;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        .user-menu-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 0.5rem);
          min-width: 200px;
          background: #1f2937;
          border-radius: 0.5rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          z-index: 1001;
        }

        .user-info {
          padding: 0.75rem 1rem;
          background: #111827;
        }

        .user-info-name {
          font-weight: 600;
          color: white;
        }

        .user-info-email {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 0.125rem;
        }

        .user-info-role {
          font-size: 0.75rem;
          color: #60a5fa;
          margin-top: 0.25rem;
        }

        .menu-divider {
          height: 1px;
          background: #374151;
        }

        .menu-item {
          display: block;
          width: 100%;
          padding: 0.625rem 1rem;
          text-align: left;
          background: none;
          border: none;
          color: #d1d5db;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }

        .menu-item:hover {
          background: #374151;
          color: white;
        }

        .menu-item-danger:hover {
          background: #7f1d1d;
          color: #fca5a5;
        }

        /* Mobile responsive */
        @media (max-width: 640px) {
          .user-name {
            display: none;
          }
          .chevron {
            display: none;
          }
          .user-menu-trigger {
            padding: 0.25rem;
          }
          .user-avatar {
            width: 2.25rem;
            height: 2.25rem;
          }
          .user-menu-dropdown {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            border-radius: 1rem 1rem 0 0;
            min-width: 100%;
          }
          .user-info {
            padding: 1rem;
          }
          .menu-item {
            padding: 1rem;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
