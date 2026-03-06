import { interactionTypeLabels, interactionTypeIcons } from '../../constants/enterprise'
import { formatDateTime } from '../../utils/formatters'
import type { Interaction, NewInteraction } from '../../types/enterprise'

interface Props {
  interactions: Interaction[]
  canEdit: boolean
  editMode: boolean
  showAddForm: boolean
  newInteraction: NewInteraction
  editingInteraction: Interaction | null
  isSaving: boolean
  onShowAddForm: () => void
  onCancelForm: () => void
  onNewInteractionChange: (interaction: NewInteraction) => void
  onSaveInteraction: () => void
  onEditInteraction: (interaction: Interaction) => void
  onDeleteInteraction: (id: number) => void
}

export function InteractionHistory({
  interactions,
  canEdit,
  editMode,
  showAddForm,
  newInteraction,
  editingInteraction,
  isSaving,
  onShowAddForm,
  onCancelForm,
  onNewInteractionChange,
  onSaveInteraction,
  onEditInteraction,
  onDeleteInteraction
}: Props) {
  return (
    <div className="section">
      <div className="section-header">
        <h3>История контактов</h3>
        {canEdit && !editMode && !showAddForm && (
          <button className="btn btn-sm btn-primary" onClick={onShowAddForm}>
            + Добавить
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="add-interaction-form">
          <div className="form-title">
            {editingInteraction ? '✏️ Редактирование записи' : '➕ Новая запись'}
          </div>
          <div className="form-row">
            <select
              value={newInteraction.interaction_type}
              onChange={e => onNewInteractionChange({
                ...newInteraction,
                interaction_type: e.target.value as Interaction['interaction_type']
              })}
            >
              {Object.entries(interactionTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Автор записи"
              value={newInteraction.created_by}
              onChange={e => onNewInteractionChange({
                ...newInteraction,
                created_by: e.target.value
              })}
            />
          </div>
          <textarea
            placeholder="Описание контакта..."
            value={newInteraction.description}
            onChange={e => onNewInteractionChange({
              ...newInteraction,
              description: e.target.value
            })}
            rows={2}
          />
          <input
            type="text"
            placeholder="Результат/итог (опционально)"
            value={newInteraction.result}
            onChange={e => onNewInteractionChange({
              ...newInteraction,
              result: e.target.value
            })}
          />
          <div className="form-actions">
            <button className="btn btn-secondary btn-sm" onClick={onCancelForm}>
              Отмена
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onSaveInteraction}
              disabled={isSaving || !newInteraction.description.trim()}
            >
              {isSaving ? 'Сохранение...' : (editingInteraction ? 'Сохранить' : 'Добавить')}
            </button>
          </div>
        </div>
      )}

      <div className="interactions-list">
        {(!interactions || interactions.length === 0) ? (
          <p className="no-interactions">Нет записей о контактах</p>
        ) : (
          interactions.map(interaction => (
            <div key={interaction.id} className="interaction-item">
              <div className="interaction-icon">
                {interactionTypeIcons[interaction.interaction_type] || '📌'}
              </div>
              <div className="interaction-content">
                <div className="interaction-header">
                  <span className="interaction-type">
                    {interactionTypeLabels[interaction.interaction_type]}
                  </span>
                  <span className="interaction-date">{formatDateTime(interaction.date)}</span>
                  {canEdit && !editMode && (
                    <div className="interaction-actions">
                      <button
                        className="btn-edit-interaction"
                        onClick={() => onEditInteraction(interaction)}
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete-interaction"
                        onClick={() => onDeleteInteraction(interaction.id)}
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <p className="interaction-description">{interaction.description}</p>
                {interaction.result && (
                  <p className="interaction-result">
                    <strong>Итог:</strong> {interaction.result}
                  </p>
                )}
                {interaction.created_by && (
                  <span className="interaction-author">— {interaction.created_by}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
