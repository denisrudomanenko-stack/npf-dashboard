import { useToastStore, type ToastType } from '../stores/toastStore'

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-500',
    icon: '✕',
  },
  warning: {
    bg: 'bg-yellow-900/90',
    border: 'border-yellow-500',
    icon: '⚠',
  },
  success: {
    bg: 'bg-green-900/90',
    border: 'border-green-500',
    icon: '✓',
  },
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-500',
    icon: 'ℹ',
  },
}

export default function Toast() {
  const { message, type, isVisible, hide } = useToastStore()

  if (!isVisible || !message) {
    return null
  }

  const styles = typeStyles[type]

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`${styles.bg} ${styles.border} border rounded-lg shadow-lg p-4 max-w-md flex items-start gap-3`}
      >
        <span className="text-lg">{styles.icon}</span>
        <div className="flex-1 text-white text-sm">{message}</div>
        <button
          onClick={hide}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
