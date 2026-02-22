import { StorageStats } from '../types'

interface StorageBarProps {
  stats: StorageStats | null
  loading?: boolean
}

function StorageBar({ stats, loading }: StorageBarProps) {
  if (loading || !stats) {
    return (
      <div className="storage-bar-container">
        <div className="storage-bar-loading">
          <div className="storage-bar-skeleton"></div>
        </div>
        <style>{styles}</style>
      </div>
    )
  }

  const getBarColor = (percent: number) => {
    if (percent >= 95) return '#dc2626' // red
    if (percent >= 80) return '#f59e0b' // orange
    return '#22c55e' // green
  }

  const getBgColor = (percent: number) => {
    if (percent >= 95) return '#fef2f2'
    if (percent >= 80) return '#fffbeb'
    return '#f0fdf4'
  }

  const color = getBarColor(stats.usage_percent)
  const bgColor = getBgColor(stats.usage_percent)
  const showWarning = stats.usage_percent >= 80

  // Format GB with 2 decimal places
  const formatGb = (bytes: number) => {
    const gb = bytes / (1024 ** 3)
    return gb.toFixed(2)
  }

  return (
    <div className="storage-bar-container" style={{ background: bgColor }}>
      <div className="storage-bar-header">
        <span className="storage-bar-icon">💾</span>
        <span className="storage-bar-title">Хранилище</span>
        <span className="storage-bar-usage" style={{ color }}>
          {formatGb(stats.total_bytes)} ГБ из {stats.limit_gb} ГБ
        </span>
      </div>

      <div className="storage-bar-track">
        <div
          className="storage-bar-fill"
          style={{
            width: `${Math.min(stats.usage_percent, 100)}%`,
            background: color
          }}
        />
      </div>

      <div className="storage-bar-footer">
        <span className="storage-bar-remaining">
          Осталось: {formatGb(stats.remaining_bytes)} ГБ
        </span>
        <span className="storage-bar-percent" style={{ color }}>
          {stats.usage_percent.toFixed(2)}%
        </span>
      </div>

      {showWarning && (
        <div className="storage-bar-warning" style={{ color }}>
          {stats.usage_percent >= 95
            ? '⚠️ Хранилище почти заполнено! Удалите ненужные документы.'
            : '⚠️ Хранилище заполняется. Рекомендуем освободить место.'}
        </div>
      )}

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .storage-bar-container {
    background: #f0fdf4;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }

  .storage-bar-loading {
    padding: 8px 0;
  }

  .storage-bar-skeleton {
    height: 8px;
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    border-radius: 4px;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .storage-bar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .storage-bar-icon {
    font-size: 14px;
  }

  .storage-bar-title {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
  }

  .storage-bar-usage {
    margin-left: auto;
    font-size: 13px;
    font-weight: 600;
  }

  .storage-bar-track {
    height: 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    overflow: hidden;
  }

  .storage-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .storage-bar-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 11px;
  }

  .storage-bar-remaining {
    color: #6b7280;
  }

  .storage-bar-percent {
    font-weight: 600;
  }

  .storage-bar-warning {
    margin-top: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }
`

export default StorageBar
