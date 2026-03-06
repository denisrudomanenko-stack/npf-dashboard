interface Props {
  selectedCount: number
  onBulkDelete: () => void
  onClearSelection: () => void
  isDeleting: boolean
}

export function BulkActionsToolbar({
  selectedCount,
  onBulkDelete,
  onClearSelection,
  isDeleting
}: Props) {
  if (selectedCount === 0) return null

  return (
    <div className="bulk-toolbar">
      <span className="bulk-count">Выбрано: {selectedCount}</span>
      <button
        className="btn btn-danger btn-sm"
        onClick={onBulkDelete}
        disabled={isDeleting}
      >
        {isDeleting ? 'Удаление...' : '🗑️ Удалить выбранные'}
      </button>
      <button className="btn btn-secondary btn-sm" onClick={onClearSelection}>
        Снять выделение
      </button>
    </div>
  )
}
