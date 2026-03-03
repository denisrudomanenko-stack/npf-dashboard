import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import UserMenu from './UserMenu'
import { useAuthStore } from '../stores/authStore'

const baseNavItems = [
  { path: '/', label: 'Дашборд', icon: '📊' },
  { path: '/enterprises', label: 'Предприятия', icon: '🏢' },
  { path: '/documents', label: 'Документы', icon: '📄' },
  { path: '/chat', label: 'AI Ассистент', icon: '🤖' },
]

function Layout() {
  const { user } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMenu = () => setMobileMenuOpen(false)

  // Sales role cannot see Models
  const canViewModels = user?.role !== 'sales'
  const navItems = canViewModels
    ? [...baseNavItems.slice(0, 3), { path: '/models', label: 'Модели', icon: '📈' }, baseNavItems[3]]
    : baseNavItems

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-content">
          <h1 className="logo">Управление НПФ</h1>

          {/* Desktop Navigation */}
          <nav className="nav desktop-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user?.role === 'admin' && (
              <>
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  Пользователи
                </NavLink>
                <NavLink
                  to="/settings/rag-queue"
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  Очередь RAG
                </NavLink>
              </>
            )}
          </nav>

          <div className="header-right">
            <UserMenu />

            {/* Mobile Menu Button */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Меню"
            >
              <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMenu} />
      )}

      {/* Mobile Navigation */}
      <nav className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={closeMenu}
            className={({ isActive }) =>
              `mobile-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <>
            <NavLink
              to="/users"
              onClick={closeMenu}
              className={({ isActive }) =>
                `mobile-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="mobile-nav-icon">👥</span>
              Пользователи
            </NavLink>
            <NavLink
              to="/settings/rag-queue"
              onClick={closeMenu}
              className={({ isActive }) =>
                `mobile-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="mobile-nav-icon">📚</span>
              Очередь RAG
            </NavLink>
          </>
        )}
      </nav>

      <main className="main container">
        <Outlet />
      </main>

      <style>{`
        .layout {
          min-height: 100vh;
        }

        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: var(--primary);
          color: white;
          padding: 1rem 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .desktop-nav {
          display: flex;
          gap: 1.5rem;
        }

        .nav-link {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
          padding: 0.25rem 0;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .nav-link:hover, .nav-link.active {
          color: white;
          border-bottom-color: white;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
        }

        .hamburger {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 24px;
          height: 18px;
        }

        .hamburger span {
          display: block;
          width: 100%;
          height: 2px;
          background: white;
          border-radius: 2px;
          transition: all 0.3s;
        }

        .hamburger.open span:nth-child(1) {
          transform: translateY(8px) rotate(45deg);
        }

        .hamburger.open span:nth-child(2) {
          opacity: 0;
        }

        .hamburger.open span:nth-child(3) {
          transform: translateY(-8px) rotate(-45deg);
        }

        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 998;
        }

        .mobile-nav {
          display: none;
          position: fixed;
          top: 73px;
          right: -280px;
          width: 280px;
          height: calc(100vh - 73px);
          background: white;
          z-index: 999;
          transition: right 0.3s ease;
          overflow-y: auto;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
        }

        .mobile-nav.open {
          right: 0;
        }

        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          color: var(--text);
          font-size: 15px;
          font-weight: 500;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
        }

        .mobile-nav-link:hover {
          background: #f8f9fa;
        }

        .mobile-nav-link.active {
          background: rgba(59, 130, 246, 0.1);
          color: var(--primary);
        }

        .mobile-nav-icon {
          font-size: 20px;
        }

        .main {
          padding-top: 73px;
          padding-bottom: 2rem;
        }

        /* Tablet & Mobile */
        @media (max-width: 1024px) {
          .desktop-nav {
            display: none;
          }

          .mobile-menu-btn {
            display: block;
          }

          .mobile-overlay {
            display: block;
          }

          .mobile-nav {
            display: block;
          }
        }

        @media (max-width: 640px) {
          .logo {
            font-size: 1rem;
          }

          .header {
            padding: 0.75rem 0;
          }

          .main {
            padding-top: 65px;
          }

          .mobile-nav {
            top: 65px;
            height: calc(100vh - 65px);
          }
        }
      `}</style>
    </div>
  )
}

export default Layout
