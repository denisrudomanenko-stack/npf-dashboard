import { categoryLabels } from '../../constants/enterprise'
import type { Enterprise } from '../../types/enterprise'

interface Props {
  editData: Partial<Enterprise>
  setEditData: (data: Partial<Enterprise>) => void
  onClose: () => void
  onCreate: () => void
  isSaving: boolean
}

export function CreateEnterpriseModal({
  editData,
  setEditData,
  onClose,
  onCreate,
  isSaving
}: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="client-card create-card" onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <h2>Новое предприятие</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="card-body">
          <div className="section">
            <div className="info-grid">
              <div className="info-item full-width">
                <label>Название *</label>
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  placeholder="ПАО «Название»"
                  autoFocus
                />
              </div>
              <div className="info-item">
                <label>ИНН</label>
                <input
                  type="text"
                  value={editData.inn || ''}
                  onChange={e => setEditData({ ...editData, inn: e.target.value })}
                  placeholder="10 или 12 цифр"
                  maxLength={12}
                />
              </div>
              <div className="info-item">
                <label>Холдинг</label>
                <input
                  type="text"
                  value={editData.holding || ''}
                  onChange={e => setEditData({ ...editData, holding: e.target.value })}
                  placeholder="Группа компаний"
                />
              </div>
              <div className="info-item">
                <label>Отрасль</label>
                <input
                  type="text"
                  value={editData.industry || ''}
                  onChange={e => setEditData({ ...editData, industry: e.target.value })}
                />
              </div>
              <div className="info-item">
                <label>Сотрудников</label>
                <input
                  type="number"
                  value={editData.employee_count || ''}
                  onChange={e => setEditData({ ...editData, employee_count: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="info-item">
                <label>Категория</label>
                <select
                  value={editData.category || 'V'}
                  onChange={e => setEditData({ ...editData, category: e.target.value as Enterprise['category'] })}
                >
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="info-item">
                <label>Ответственный менеджер</label>
                <input
                  type="text"
                  value={editData.manager || ''}
                  onChange={e => setEditData({ ...editData, manager: e.target.value })}
                  placeholder="ФИО менеджера"
                />
              </div>
              <div className="info-item">
                <label>Контактное лицо</label>
                <input
                  type="text"
                  value={editData.contact_person || ''}
                  onChange={e => setEditData({ ...editData, contact_person: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-primary"
            onClick={onCreate}
            disabled={isSaving || !editData.name?.trim()}
          >
            {isSaving ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
