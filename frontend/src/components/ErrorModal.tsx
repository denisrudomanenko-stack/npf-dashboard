interface ErrorModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'error' | 'warning' | 'info'
}

function ErrorModal({ isOpen, onClose, title, message, type = 'error' }: ErrorModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '❌'
    }
  }

  const getColors = () => {
    switch (type) {
      case 'error': return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '#dc2626' }
      case 'warning': return { bg: '#fffbeb', border: '#fed7aa', text: '#d97706', icon: '#d97706' }
      case 'info': return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', icon: '#2563eb' }
      default: return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '#dc2626' }
    }
  }

  const colors = getColors()

  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div className="error-modal" onClick={e => e.stopPropagation()}>
        <div className="error-modal-header" style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
          <span className="error-modal-icon" style={{ color: colors.icon }}>{getIcon()}</span>
          <h3 style={{ color: colors.text }}>{title}</h3>
          <button className="error-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="error-modal-body">
          <p>{message}</p>
        </div>
        <div className="error-modal-footer">
          <button className="error-modal-btn" onClick={onClose} style={{ background: colors.text }}>
            Понятно
          </button>
        </div>
      </div>

      <style>{`
        .error-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
        }

        .error-modal {
          background: #fff;
          border-radius: 12px;
          width: 90%;
          max-width: 400px;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .error-modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
        }

        .error-modal-icon {
          font-size: 24px;
        }

        .error-modal-header h3 {
          flex: 1;
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .error-modal-close {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #9ca3af;
          padding: 4px;
        }

        .error-modal-close:hover {
          color: #6b7280;
        }

        .error-modal-body {
          padding: 20px;
        }

        .error-modal-body p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #374151;
          white-space: pre-line;
        }

        .error-modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #f3f4f6;
          display: flex;
          justify-content: flex-end;
        }

        .error-modal-btn {
          padding: 10px 24px;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .error-modal-btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  )
}

export default ErrorModal
