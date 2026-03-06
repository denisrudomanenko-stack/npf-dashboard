import { salesStages, salesStatusLabels } from '../../constants/enterprise'

interface Props {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filterCategory: string
  setFilterCategory: (category: string) => void
  filterSalesStatus: string
  setFilterSalesStatus: (status: string) => void
  filteredCount: number
  totalCount: number
}

export function EnterpriseFilters({
  searchQuery,
  setSearchQuery,
  filterCategory,
  setFilterCategory,
  filterSalesStatus,
  setFilterSalesStatus,
  filteredCount,
  totalCount
}: Props) {
  return (
    <div className="filters-row">
      <input
        type="text"
        placeholder="Поиск по названию, ИНН, холдингу, отрасли или менеджеру..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="search-input"
      />
      <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
        <option value="">Все категории</option>
        <option value="A">A — Быстрые победы</option>
        <option value="B">B — Рабочие кейсы</option>
        <option value="V">В — Длинные проекты</option>
        <option value="G">Г — Заморозка</option>
      </select>
      <select value={filterSalesStatus} onChange={e => setFilterSalesStatus(e.target.value)}>
        <option value="">Все этапы продаж</option>
        {salesStages.map(s => (
          <option key={s} value={s}>{salesStatusLabels[s]}</option>
        ))}
      </select>
      <span className="results-count">{filteredCount} из {totalCount}</span>
    </div>
  )
}
