import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnConfig } from '../../types/enterprise'

interface Props {
  column: ColumnConfig
  onToggle: () => void
  onRename: (label: string) => void
}

export function SortableColumnItem({ column, onToggle, onRename }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="sortable-column-item">
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      <input
        type="checkbox"
        checked={column.visible}
        onChange={onToggle}
      />
      <input
        type="text"
        value={column.label}
        onChange={e => onRename(e.target.value)}
        className="column-label-input"
      />
    </div>
  )
}
