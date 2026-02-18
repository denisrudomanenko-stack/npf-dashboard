import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/enterprises', label: 'Предприятия' },
  { path: '/roadmap', label: 'Дорожная карта' },
  { path: '/documents', label: 'Документы' },
  { path: '/chat', label: 'AI Ассистент' },
]

function Layout() {
  return (
    <div className="layout">
      <header className="header">
        <div className="container header-content">
          <h1 className="logo">NPF Development</h1>
          <nav className="nav">
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
          </nav>
        </div>
      </header>
      <main className="main container">
        <Outlet />
      </main>
      <style>{`
        .header {
          background: var(--primary);
          color: white;
          padding: 1rem 0;
          margin-bottom: 2rem;
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
        .nav {
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
        .main {
          padding-bottom: 2rem;
        }
      `}</style>
    </div>
  )
}

export default Layout
