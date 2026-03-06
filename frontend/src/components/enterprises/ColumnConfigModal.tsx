import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ColumnConfig } from '../../types/enterprise'
import { SortableColumnItem } from './SortableColumnItem'

interface Props {
  columns: ColumnConfig[]
  setColumns: (columns: ColumnConfig[]) => void
  onSave: () => void
  onReset: () => void
  onClose: () => void
  isSaving: boolean
}

export function ColumnConfigModal({
  columns,
  setColumns,
  onSave,
  onReset,
  onClose,
  isSaving
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex(i => i.id === active.id)
      const newIndex = columns.findIndex(i => i.id === over.id)
      setColumns(arrayMove(columns, oldIndex, newIndex))
    }
  }

  const toggleColumnVisibility = (columnId: string) => {
    setColumns(columns.map(c => c.id === columnId ? { ...c, visible: !c.visible } : c))
  }

  const renameColumn = (columnId: string, newLabel: string) => {
    setColumns(columns.map(c => c.id === columnId ? { ...c, label: newLabel } : c))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="config-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Настройка столбцов</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="config-hint">
            Перетаскивайте для изменения порядка. Снимите галочку, чтобы скрыть столбец.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="columns-list">
                {columns.map(col => (
                  <SortableColumnItem
                    key={col.id}
                    column={col}
                    onToggle={() => toggleColumnVisibility(col.id)}
                    onRename={(label) => renameColumn(col.id, label)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onReset}>
            Сбросить
          </button>
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
