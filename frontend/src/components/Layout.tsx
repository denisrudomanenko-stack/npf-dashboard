import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard', tooltip: 'Дорожная карта развития корпоративного блока НПФ: KPI, timeline, pipeline предприятий, воронка продаж, матрица рисков и ключевые вехи.' },
  { path: '/enterprises', label: 'Предприятия', tooltip: 'Реестр корпоративных клиентов НПФ: управление списком предприятий, отслеживание статусов (потенциал, переговоры, пилот, активный), импорт данных из Excel/CSV.' },
  { path: '/documents', label: 'Документы', tooltip: 'База знаний для AI-ассистента (RAG): загрузка регламентов, презентаций, FAQ и других документов. Векторизация для семантического поиска, OCR для сканированных PDF.' },
  { path: '/models', label: 'Модели', tooltip: 'Финансовые модели и калькуляторы: МГД (минимальная гарантированная доходность), стресс-тесты портфеля, юнит-экономика КПП, оценка инфраструктуры.' },
  { path: '/chat', label: 'AI Ассистент', tooltip: 'Интеллектуальный помощник для консультаций по продуктам НПФ (КПП, ПДС). Использует базу знаний для точных ответов. Поддержка нескольких LLM-моделей.' },
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
                title={item.tooltip}
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
          padding-top: 73px;
          padding-bottom: 2rem;
        }
      `}</style>
    </div>
  )
}

export default Layout
