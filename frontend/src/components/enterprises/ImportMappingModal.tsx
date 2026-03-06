import type { ImportPreview } from '../../types/enterprise'

interface Props {
  file: File | null
  preview: ImportPreview
  mapping: Record<string, string>
  onUpdateMapping: (excelCol: string, fieldKey: string) => void
  onConfirm: () => void
  onClose: () => void
  isImporting: boolean
}

export function ImportMappingModal({
  file,
  preview,
  mapping,
  onUpdateMapping,
  onConfirm,
  onClose,
  isImporting
}: Props) {
  const isNameMapped = Object.values(mapping).includes('name')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Сопоставление колонок</h3>
            <span className="import-file-info">
              {file?.name} — {preview.total_rows} строк данных (без заголовка)
            </span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="mapping-hint">
            <div className="hint-header">
              <span className="hint-icon">{preview.mapping_method === 'llm' ? '🤖' : '📋'}</span>
              <strong>
                {preview.mapping_method === 'llm'
                  ? 'AI проанализировал структуру файла'
                  : 'Автоматическое сопоставление'}
              </strong>
              {preview.mapping_method === 'llm' && (
                <span className="llm-badge">LLM</span>
              )}
            </div>
            <p>
              {preview.mapping_method === 'llm'
                ? 'Локальная LLM-модель проанализировала заголовки и примеры данных для интеллектуального сопоставления полей.'
                : 'Система сопоставила колонки на основе названий заголовков.'}
              {' '}Проверьте соответствие и измените при необходимости.
            </p>
            <p>Поле "Наименование" <span className="required-star">*</span> обязательно для импорта.</p>
          </div>

          <div className="mapping-table-wrapper">
            <table className="mapping-table">
              <thead>
                <tr>
                  <th>Заголовок в файле (1-я строка)</th>
                  <th>Примеры данных (строки 2-3)</th>
                  <th>Поле в системе</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {preview.columns.map(col => {
                  const suggestedField = preview.suggested_mapping[col]
                  const currentField = mapping[col]
                  const isAutoSuggested = suggestedField && currentField === suggestedField
                  const isMapped = !!currentField

                  return (
                    <tr key={col} className={isMapped ? 'row-mapped' : ''}>
                      <td className="col-name">
                        {col}
                        {isAutoSuggested && <span className="auto-badge">авто</span>}
                      </td>
                      <td className="col-sample">
                        {preview.sample_data.slice(0, 2).map((row, i) => (
                          <div key={i} className="sample-value">
                            {String(row[col] || '—').substring(0, 40)}
                          </div>
                        ))}
                      </td>
                      <td className="col-mapping">
                        <select
                          value={currentField || ''}
                          onChange={e => onUpdateMapping(col, e.target.value)}
                          className={`${currentField === 'name' ? 'required-mapped' : ''} ${isMapped ? 'is-mapped' : ''}`}
                        >
                          <option value="">— Не импортировать —</option>
                          {Object.entries(preview.available_fields).map(([key, field]) => (
                            <option key={key} value={key}>
                              {field.label} {field.required ? '*' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="col-status">
                        {currentField === 'name' && <span className="status-icon status-required">✓</span>}
                        {currentField && currentField !== 'name' && <span className="status-icon status-ok">✓</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mapping-summary">
            <div className="summary-left">
              <span className={isNameMapped ? 'valid' : 'invalid'}>
                {isNameMapped ? '✓' : '✗'} Наименование
              </span>
            </div>
            <div className="summary-right">
              <span className="auto-count">
                Автоопределено: {Object.entries(preview.suggested_mapping).filter(([k, v]) => v && mapping[k] === v).length}
              </span>
              <span className="mapped-count">
                Всего сопоставлено: {Object.values(mapping).filter(v => v).length} из {preview.columns.length}
              </span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isImporting || !isNameMapped}
          >
            {isImporting ? 'Импорт...' : `Импортировать ${preview.total_rows} строк`}
          </button>
        </div>
      </div>
    </div>
  )
}
