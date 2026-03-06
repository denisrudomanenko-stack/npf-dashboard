import { categoryLabels, statusLabels, salesStages, salesStatusLabels } from '../../constants/enterprise'
import { formatNumber } from '../../utils/formatters'
import { InteractionHistory } from './InteractionHistory'
import type { Enterprise, Interaction, NewInteraction } from '../../types/enterprise'

interface Props {
  enterprise: Enterprise
  editData: Partial<Enterprise>
  setEditData: (data: Partial<Enterprise>) => void
  editMode: boolean
  setEditMode: (mode: boolean) => void
  canEdit: boolean
  canEditEntity: (createdById: number | null) => boolean
  isSaving: boolean
  confirmDelete: boolean
  setConfirmDelete: (confirm: boolean) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
  // Interaction props
  showAddInteraction: boolean
  newInteraction: NewInteraction
  editingInteraction: Interaction | null
  savingInteraction: boolean
  onShowAddInteraction: () => void
  onCancelInteractionForm: () => void
  onNewInteractionChange: (interaction: NewInteraction) => void
  onSaveInteraction: () => void
  onEditInteraction: (interaction: Interaction) => void
  onDeleteInteraction: (id: number) => void
}

export function EnterpriseCard({
  enterprise,
  editData,
  setEditData,
  editMode,
  setEditMode,
  canEdit,
  canEditEntity,
  isSaving,
  confirmDelete,
  setConfirmDelete,
  onClose,
  onSave,
  onDelete,
  showAddInteraction,
  newInteraction,
  editingInteraction,
  savingInteraction,
  onShowAddInteraction,
  onCancelInteractionForm,
  onNewInteractionChange,
  onSaveInteraction,
  onEditInteraction,
  onDeleteInteraction
}: Props) {
  const getSalesStatusIndex = (status: string) => salesStages.indexOf(status as typeof salesStages[number])
  const canEditThis = canEditEntity(enterprise.created_by_id)

  const getCategoryBadge = (category: string) => (
    <span className={`category-badge cat-${category}`}>
      {category === 'V' ? 'В' : category === 'G' ? 'Г' : category}
    </span>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="client-card" onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title-row">
            {editMode ? (
              <input
                type="text"
                className="name-input"
                value={editData.name || ''}
                onChange={e => setEditData({ ...editData, name: e.target.value })}
                placeholder="Название предприятия"
              />
            ) : (
              <h2>{enterprise.name}</h2>
            )}
            <div className="card-actions">
              {canEditThis && !editMode && (
                <button
                  className="btn-icon"
                  onClick={() => setEditMode(true)}
                  title="Редактировать"
                >
                  ✏️
                </button>
              )}
              {canEdit && !canEditThis && !editMode && (
                <button
                  className="btn-icon"
                  disabled
                  title="Вы можете редактировать только свои записи"
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  ✏️
                </button>
              )}
              <button className="btn-close" onClick={onClose}>✕</button>
            </div>
          </div>
          <div className="card-meta">
            {getCategoryBadge(enterprise.category)}
            <span className="score-display">{enterprise.score} баллов</span>
            {enterprise.manager && (
              <span className="manager-badge">👤 {enterprise.manager}</span>
            )}
          </div>
        </div>

        <div className="card-body">
          {/* Sales Funnel */}
          <div className="section">
            <h3>Воронка продаж</h3>
            <div className="sales-funnel">
              {salesStages.map((stage, idx) => {
                const currentIdx = getSalesStatusIndex(editMode ? (editData.sales_status || 'contact') : enterprise.sales_status)
                const isPast = idx < currentIdx
                const isCurrent = idx === currentIdx
                return (
                  <div
                    key={stage}
                    className={`funnel-stage ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''} ${editMode ? 'editable' : ''}`}
                    onClick={() => editMode && setEditData({ ...editData, sales_status: stage as Enterprise['sales_status'] })}
                    title={salesStatusLabels[stage]}
                  >
                    <span className="stage-dot">{isPast ? '✓' : isCurrent ? '●' : '○'}</span>
                    <span className="stage-label">{salesStatusLabels[stage]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Main Info */}
          <div className="section">
            <h3>Основная информация</h3>
            <div className="info-grid">
              <InfoItem label="ИНН" value={enterprise.inn} editMode={editMode}
                editValue={editData.inn} onChange={v => setEditData({ ...editData, inn: v })}
                placeholder="10 или 12 цифр" maxLength={12} />
              <InfoItem label="Холдинг" value={enterprise.holding} editMode={editMode}
                editValue={editData.holding} onChange={v => setEditData({ ...editData, holding: v })}
                placeholder="Группа компаний" />
              <InfoItem label="Отрасль" value={enterprise.industry} editMode={editMode}
                editValue={editData.industry} onChange={v => setEditData({ ...editData, industry: v })} />
              <InfoItem label="Сотрудников" value={enterprise.employee_count ? formatNumber(enterprise.employee_count) : null}
                editMode={editMode} type="number"
                editValue={String(editData.employee_count || '')}
                onChange={v => setEditData({ ...editData, employee_count: parseInt(v) || 0 })} />
              <InfoItem label="Проникновение ЗП" value={enterprise.bank_penetration ? `${enterprise.bank_penetration}%` : null}
                editMode={editMode} type="number" step="0.1"
                editValue={String(editData.bank_penetration || '')}
                onChange={v => setEditData({ ...editData, bank_penetration: parseFloat(v) || 0 })} />

              <div className="info-item">
                <label>Категория</label>
                {editMode ? (
                  <select
                    value={editData.category || 'V'}
                    onChange={e => setEditData({ ...editData, category: e.target.value as Enterprise['category'] })}
                  >
                    {Object.entries(categoryLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <span>{categoryLabels[enterprise.category]}</span>
                )}
              </div>

              <InfoItem label="Скоринг-балл" value={String(enterprise.score)} editMode={editMode}
                type="number" min={0} max={100}
                editValue={String(editData.score || 0)}
                onChange={v => setEditData({ ...editData, score: parseInt(v) || 0 })} />
              <InfoItem label="Ответственный менеджер" value={enterprise.manager} editMode={editMode}
                editValue={editData.manager} onChange={v => setEditData({ ...editData, manager: v })}
                placeholder="ФИО менеджера" />

              <div className="info-item">
                <label>Статус</label>
                {editMode ? (
                  <select
                    value={editData.status || 'prospect'}
                    onChange={e => setEditData({ ...editData, status: e.target.value as Enterprise['status'] })}
                  >
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <span>{statusLabels[enterprise.status]}</span>
                )}
              </div>

              <InfoItem label="Площадки" value={enterprise.locations} editMode={editMode}
                editValue={editData.locations} onChange={v => setEditData({ ...editData, locations: v })}
                placeholder="Москва, Санкт-Петербург, ..." />
            </div>
          </div>

          {/* Contacts */}
          <div className="section">
            <h3>Контакты</h3>
            <div className="info-grid">
              <InfoItem label="Контактное лицо" value={enterprise.contact_person} editMode={editMode}
                editValue={editData.contact_person} onChange={v => setEditData({ ...editData, contact_person: v })}
                placeholder="ФИО" />
              <InfoItem label="Телефон" value={enterprise.contact_phone} editMode={editMode}
                type="tel" editValue={editData.contact_phone}
                onChange={v => setEditData({ ...editData, contact_phone: v })} placeholder="+7 ..." />
              <div className="info-item full-width">
                <label>Email</label>
                {editMode ? (
                  <input
                    type="email"
                    value={editData.contact_email || ''}
                    onChange={e => setEditData({ ...editData, contact_email: e.target.value })}
                    placeholder="email@company.ru"
                  />
                ) : (
                  <span>{enterprise.contact_email || '—'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Interaction History */}
          <InteractionHistory
            interactions={enterprise.interactions}
            canEdit={canEdit}
            editMode={editMode}
            showAddForm={showAddInteraction}
            newInteraction={newInteraction}
            editingInteraction={editingInteraction}
            isSaving={savingInteraction}
            onShowAddForm={onShowAddInteraction}
            onCancelForm={onCancelInteractionForm}
            onNewInteractionChange={onNewInteractionChange}
            onSaveInteraction={onSaveInteraction}
            onEditInteraction={onEditInteraction}
            onDeleteInteraction={onDeleteInteraction}
          />

          {/* Notes */}
          <div className="section">
            <h3>Заметки</h3>
            {editMode ? (
              <textarea
                value={editData.notes || ''}
                onChange={e => setEditData({ ...editData, notes: e.target.value })}
                placeholder="Заметки о клиенте..."
                rows={3}
              />
            ) : (
              <p className="notes-text">{enterprise.notes || 'Нет заметок'}</p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="card-footer">
            {confirmDelete ? (
              <div className="delete-confirm">
                <span>Удалить предприятие?</span>
                <button className="btn btn-danger" onClick={onDelete} disabled={isSaving}>
                  {isSaving ? '...' : 'Да, удалить'}
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </div>
            ) : (
              <>
                {canEditThis ? (
                  <button className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
                    Удалить
                  </button>
                ) : (
                  <button
                    className="btn btn-danger-outline"
                    disabled
                    title="Вы можете удалять только свои записи"
                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                  >
                    Удалить
                  </button>
                )}
                <div className="footer-right">
                  {editMode ? (
                    <>
                      <button className="btn btn-secondary" onClick={() => { setEditMode(false); setEditData(enterprise); }}>
                        Отмена
                      </button>
                      <button className="btn btn-primary" onClick={onSave} disabled={isSaving}>
                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                      Редактировать
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper component for info items
interface InfoItemProps {
  label: string
  value: string | number | null | undefined
  editMode: boolean
  editValue?: string | null
  onChange?: (value: string) => void
  type?: string
  placeholder?: string
  maxLength?: number
  min?: number
  max?: number
  step?: string
}

function InfoItem({ label, value, editMode, editValue, onChange, type = 'text', placeholder, maxLength, min, max, step }: InfoItemProps) {
  return (
    <div className="info-item">
      <label>{label}</label>
      {editMode ? (
        <input
          type={type}
          value={editValue || ''}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
        />
      ) : (
        <span>{value || '—'}</span>
      )}
    </div>
  )
}
