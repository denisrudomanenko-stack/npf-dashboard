import { useState, useMemo, useCallback } from 'react'

// ==================== TYPES ====================
interface Tranche {
  id: string
  date: string
  amount: number // общая сумма транша
}

interface MGDInputs {
  tranches: Tranche[]
  guaranteeRate: number // g - annual rate
  grossReturn: number // r - annual rate
  managementFee: number // mf - annual rate
  performanceFee: number // pf - optional
  dayCountConvention: 'ACT/365' | '30/360'
  startDate: string
  endDate: string
  feeChargingBasis: 'A' | 'B' // A: avg NAV, B: pro-rata
  returnApplicationBasis: 'A' | 'B'
  guaranteeFirstTrancheOnly: boolean // МГД только на первый взнос
  volatility: number // sigma for Monte Carlo
  monteCarloEnabled: boolean
  monteCarloSims: number
}

interface CalculationResults {
  // Per tranche details
  trancheDetails: {
    id: string
    date: string
    amount: number
    timeFraction: number
    guaranteedAccrual: number
    grossIncome: number
    fees: number
  }[]
  // Aggregates
  totalDeposit: number
  weightedNAV: number
  guaranteedAccrual: number
  grossIncome: number
  totalFees: number
  netIncome: number
  deficit: number
  surplus: number
  breakevenReturn: number
  coverageRatio: number
  // Monte Carlo results
  monteCarlo?: {
    probDeficit: number
    expectedTopUp: number
    var95TopUp: number
    simResults: number[]
  }
}

interface SensitivityPoint {
  delta: number
  deficit: number
  surplus: number
}

interface Recommendation {
  category: 'product' | 'fees' | 'investment' | 'governance'
  priority: 'high' | 'medium' | 'low'
  text: string
}

// ==================== MODEL FUNCTIONS ====================

function daysBetween(date1: string, date2: string, convention: 'ACT/365' | '30/360'): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)

  if (convention === 'ACT/365') {
    return Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
  } else {
    // 30/360 convention
    const y1 = d1.getFullYear(), m1 = d1.getMonth() + 1, day1 = Math.min(d1.getDate(), 30)
    const y2 = d2.getFullYear(), m2 = d2.getMonth() + 1, day2 = Math.min(d2.getDate(), 30)
    return Math.max(0, 360 * (y2 - y1) + 30 * (m2 - m1) + (day2 - day1))
  }
}

function yearFraction(days: number, convention: 'ACT/365' | '30/360'): number {
  return days / (convention === 'ACT/365' ? 365 : 360)
}

function calculateTimeFraction(
  trancheDate: string,
  startDate: string,
  endDate: string,
  convention: 'ACT/365' | '30/360'
): number {
  const effectiveStart = trancheDate > startDate ? trancheDate : startDate
  if (effectiveStart >= endDate) return 0

  const totalDays = daysBetween(startDate, endDate, convention)
  const trancheDays = daysBetween(effectiveStart, endDate, convention)

  return totalDays > 0 ? trancheDays / totalDays : 0
}

function calculate(inputs: MGDInputs): CalculationResults {
  const {
    tranches, guaranteeRate, grossReturn, managementFee,
    dayCountConvention, startDate, endDate, feeChargingBasis, returnApplicationBasis,
    guaranteeFirstTrancheOnly
  } = inputs

  const totalPeriodDays = daysBetween(startDate, endDate, dayCountConvention)
  const periodYearFraction = yearFraction(totalPeriodDays, dayCountConvention)

  // Sort tranches by date to identify the first one
  const sortedTranches = [...tranches].sort((a, b) => a.date.localeCompare(b.date))
  const firstTrancheId = sortedTranches.length > 0 ? sortedTranches[0].id : null

  // Calculate per-tranche details
  const trancheDetails = tranches.map(t => {
    const amount = t.amount
    const timeFraction = calculateTimeFraction(t.date, startDate, endDate, dayCountConvention)

    // Guaranteed accrual for this tranche
    // If guaranteeFirstTrancheOnly is enabled, only first tranche gets guarantee
    const isGuaranteed = !guaranteeFirstTrancheOnly || t.id === firstTrancheId
    const guaranteedAccrual = isGuaranteed
      ? amount * guaranteeRate * timeFraction * periodYearFraction
      : 0

    // Gross income for this tranche (if basis B)
    const grossIncomeB = amount * grossReturn * timeFraction * periodYearFraction

    // Fees for this tranche (if basis B)
    const feesB = amount * managementFee * timeFraction * periodYearFraction

    return {
      id: t.id,
      date: t.date,
      amount,
      timeFraction,
      guaranteedAccrual,
      grossIncome: grossIncomeB,
      fees: feesB
    }
  })

  // Aggregates
  const totalDeposit = trancheDetails.reduce((sum, t) => sum + t.amount, 0)
  const weightedNAV = trancheDetails.reduce((sum, t) => sum + t.amount * t.timeFraction, 0)
  const guaranteedAccrual = trancheDetails.reduce((sum, t) => sum + t.guaranteedAccrual, 0)

  // Gross income
  let grossIncome: number
  if (returnApplicationBasis === 'A') {
    grossIncome = weightedNAV * grossReturn * periodYearFraction
  } else {
    grossIncome = trancheDetails.reduce((sum, t) => sum + t.grossIncome, 0)
  }

  // Fees
  let totalFees: number
  if (feeChargingBasis === 'A') {
    totalFees = weightedNAV * managementFee * periodYearFraction
  } else {
    totalFees = trancheDetails.reduce((sum, t) => sum + t.fees, 0)
  }

  const netIncome = grossIncome - totalFees
  const deficit = Math.max(0, guaranteedAccrual - netIncome)
  const surplus = Math.max(0, netIncome - guaranteedAccrual)

  // Breakeven return: solve for r where netIncome = guaranteedAccrual
  // netIncome = weightedNAV * r * yearFrac - fees = guaranteedAccrual
  // r = (guaranteedAccrual + fees) / (weightedNAV * yearFrac)
  const breakevenReturn = weightedNAV > 0 && periodYearFraction > 0
    ? (guaranteedAccrual + totalFees) / (weightedNAV * periodYearFraction)
    : 0

  const coverageRatio = guaranteedAccrual > 0 ? netIncome / guaranteedAccrual : 1

  return {
    trancheDetails,
    totalDeposit,
    weightedNAV,
    guaranteedAccrual,
    grossIncome,
    totalFees,
    netIncome,
    deficit,
    surplus,
    breakevenReturn,
    coverageRatio
  }
}

// Seeded random for reproducibility
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

// Box-Muller transform for normal distribution
function normalRandom(mean: number, std: number, rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

function runMonteCarlo(inputs: MGDInputs, sims: number = 10000): CalculationResults['monteCarlo'] {
  const rng = seededRandom(42)
  const deficits: number[] = []

  for (let i = 0; i < sims; i++) {
    const simulatedReturn = normalRandom(inputs.grossReturn, inputs.volatility, rng)
    const simInputs = { ...inputs, grossReturn: simulatedReturn }
    const result = calculate(simInputs)
    deficits.push(result.deficit)
  }

  deficits.sort((a, b) => a - b)

  const deficitsAboveZero = deficits.filter(d => d > 0)
  const probDeficit = deficitsAboveZero.length / sims
  const expectedTopUp = deficits.reduce((s, d) => s + d, 0) / sims
  const var95Index = Math.floor(sims * 0.95)
  const var95TopUp = deficits[var95Index] || 0

  return {
    probDeficit,
    expectedTopUp,
    var95TopUp,
    simResults: deficits
  }
}

function calculateSensitivity(inputs: MGDInputs, paramName: 'grossReturn' | 'guaranteeRate' | 'managementFee'): SensitivityPoint[] {
  const deltas = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02]
  return deltas.map(delta => {
    const modifiedInputs = { ...inputs, [paramName]: inputs[paramName] + delta }
    const result = calculate(modifiedInputs)
    return { delta, deficit: result.deficit, surplus: result.surplus }
  })
}

function generateRecommendations(inputs: MGDInputs, results: CalculationResults): Recommendation[] {
  const recs: Recommendation[] = []
  const mc = results.monteCarlo

  // Product term mitigations
  if (results.deficit > 0 || (mc && mc.probDeficit > 0.3)) {
    recs.push({
      category: 'product',
      priority: 'high',
      text: 'Привязать гарантию к ключевой ставке минус спред (плавающая МГД), чтобы снизить риск при падении рынка'
    })
    recs.push({
      category: 'product',
      priority: 'high',
      text: 'Распространять гарантию только на первоначальный взнос, дополнительные взносы — без гарантии или с пониженной ставкой'
    })
    recs.push({
      category: 'product',
      priority: 'medium',
      text: 'Ввести коридор участия: минимальная гарантия + сниженная доля от превышения (participation rate)'
    })
  }

  if (inputs.guaranteeRate > inputs.grossReturn) {
    recs.push({
      category: 'product',
      priority: 'high',
      text: `Гарантия (${(inputs.guaranteeRate * 100).toFixed(1)}%) превышает ожидаемую доходность (${(inputs.grossReturn * 100).toFixed(1)}%). Критически пересмотреть условия продукта`
    })
  }

  // Fee restructuring
  if (results.totalFees > results.deficit * 0.5 && results.deficit > 0) {
    recs.push({
      category: 'fees',
      priority: 'medium',
      text: 'Рассмотреть снижение или отсрочку комиссии при недостижении гарантии (contingent fee)'
    })
    recs.push({
      category: 'fees',
      priority: 'medium',
      text: 'Внедрить тарифную сетку: пониженная комиссия при низкой доходности портфеля'
    })
  }

  // Investment mitigations
  if (results.breakevenReturn > inputs.grossReturn + 0.02) {
    recs.push({
      category: 'investment',
      priority: 'high',
      text: `Требуемая безубыточная доходность (${(results.breakevenReturn * 100).toFixed(1)}%) значительно выше ожидаемой. Пересмотреть инвестиционную стратегию`
    })
  }

  recs.push({
    category: 'investment',
    priority: 'medium',
    text: 'Диверсифицировать портфель: ОФЗ-линкер, корпоративные облигации, инфраструктурные проекты с фиксированной доходностью'
  })

  if (inputs.volatility > 0.1) {
    recs.push({
      category: 'investment',
      priority: 'high',
      text: 'Высокая волатильность портфеля. Рассмотреть хеджирование процентного риска (IRS) или опционные стратегии'
    })
  }

  // Risk governance
  recs.push({
    category: 'governance',
    priority: 'medium',
    text: 'Внедрить систему лимитов: предупредительный (coverage ratio < 1.2) и критический (< 1.0) уровни'
  })

  if (mc && mc.probDeficit > 0.5) {
    recs.push({
      category: 'governance',
      priority: 'high',
      text: 'Вероятность дефицита > 50%. Ограничить приём новых средств до стабилизации портфеля'
    })
  }

  recs.push({
    category: 'governance',
    priority: 'low',
    text: 'KPI мониторинга: coverage ratio, buffer до гарантии, breakeven return, VaR дефицита'
  })

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 10)
}

// ==================== COMPONENT ====================

const defaultInputs: MGDInputs = {
  tranches: [
    { id: '1', date: '2026-01-01', amount: 10000000 },
    { id: '2', date: '2026-02-01', amount: 90000000 }
  ],
  guaranteeRate: 10, // stored as percentage for easier input
  grossReturn: 8,
  managementFee: 1.5,
  performanceFee: 0,
  dayCountConvention: 'ACT/365',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  feeChargingBasis: 'A',
  returnApplicationBasis: 'A',
  guaranteeFirstTrancheOnly: false,
  volatility: 5,
  monteCarloEnabled: true,
  monteCarloSims: 10000
}

function formatCurrency(value: number): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'n/a'
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value).replace(/\u00A0/g, ' ') // ensure regular spaces
}

function formatNumber(value: number): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'n/a'
  }
  return new Intl.NumberFormat('ru-RU').format(value).replace(/\u00A0/g, ' ')
}

function formatPercent(value: number): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'n/a'
  }
  return `${(value * 100).toFixed(2)}%`
}

// Format number for display in input fields with space separators
function formatInputNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '')) : value
  if (isNaN(num) || num === 0) return ''
  return new Intl.NumberFormat('ru-RU').format(num).replace(/\u00A0/g, ' ')
}

// Parse formatted number string to number
function parseInputNumber(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(/,/g, '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function Models() {
  const [inputs, setInputs] = useState<MGDInputs>(defaultInputs)
  const [activeTab, setActiveTab] = useState<'calculator' | 'sensitivity' | 'montecarlo' | 'recommendations'>('calculator')
  const [showFormulas, setShowFormulas] = useState(false)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // Convert percentage inputs to decimals for calculations
  const calcInputs = useMemo(() => ({
    ...inputs,
    guaranteeRate: inputs.guaranteeRate / 100,
    grossReturn: inputs.grossReturn / 100,
    managementFee: inputs.managementFee / 100,
    volatility: inputs.volatility / 100
  }), [inputs])

  // Calculations
  const results = useMemo(() => calculate(calcInputs), [calcInputs])

  const monteCarloResults = useMemo(() => {
    if (!inputs.monteCarloEnabled) return undefined
    return runMonteCarlo(calcInputs, inputs.monteCarloSims)
  }, [calcInputs, inputs.monteCarloEnabled, inputs.monteCarloSims])

  const resultsWithMC = useMemo(() => ({
    ...results,
    monteCarlo: monteCarloResults
  }), [results, monteCarloResults])

  const sensitivityReturn = useMemo(() => calculateSensitivity(calcInputs, 'grossReturn'), [calcInputs])
  const sensitivityGuarantee = useMemo(() => calculateSensitivity(calcInputs, 'guaranteeRate'), [calcInputs])
  const sensitivityFee = useMemo(() => calculateSensitivity(calcInputs, 'managementFee'), [calcInputs])

  const recommendations = useMemo(() => generateRecommendations(calcInputs, resultsWithMC), [calcInputs, resultsWithMC])

  // Handlers
  const updateInput = useCallback(<K extends keyof MGDInputs>(key: K, value: MGDInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleNumberChange = (key: keyof MGDInputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.valueAsNumber
    if (!isNaN(val)) {
      updateInput(key, val as any)
    } else if (e.target.value === '') {
      updateInput(key, 0 as any)
    }
  }

  const addTranche = () => {
    const newId = String(Date.now())
    setInputs(prev => ({
      ...prev,
      tranches: [...prev.tranches, { id: newId, date: '2026-03-01', amount: 10000000 }]
    }))
  }

  const removeTranche = (id: string) => {
    setInputs(prev => ({
      ...prev,
      tranches: prev.tranches.filter(t => t.id !== id)
    }))
  }

  const updateTranche = (id: string, field: keyof Tranche, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      tranches: prev.tranches.map(t => t.id === id ? { ...t, [field]: value } : t)
    }))
  }

  const resetToDefaults = () => setInputs(defaultInputs)

  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, string> = {
      product: '📋',
      fees: '💰',
      investment: '📈',
      governance: '🛡️'
    }
    return icons[cat] || '•'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#6b7280'
    }
    return colors[priority] || '#6b7280'
  }

  return (
    <div className="models-wrapper">
      {/* Left Sidebar - Inputs */}
      <aside className="inputs-panel">
        <div className="panel-header">
          <span className="panel-title" title="Минимальная гарантированная доходность (МГД) — финансовый инструмент для пенсионных продуктов с защитой капитала">📊 Калькулятор МГД</span>
          <button className="btn-reset" onClick={resetToDefaults} title="Сбросить все параметры к значениям по умолчанию: ставка гарантии 10%, доходность 8%, комиссия 1.5%, два тестовых транша">
            ↺
          </button>
        </div>

        <div className="inputs-scroll">
          {/* Basic Parameters */}
          <section className="input-section">
            <h3 title="Ключевые финансовые параметры продукта с МГД">Основные параметры</h3>

            <div className="input-group">
              <label title="Минимальная доходность, которую НПФ гарантирует клиенту. При недостижении — фонд компенсирует разницу из собственных средств">Ставка гарантии (g), % годовых</label>
              <input
                type="number"
                value={inputs.guaranteeRate || ''}
                onChange={handleNumberChange('guaranteeRate')}
                step={0.5}
                title="Типичные значения: 4-8% для консервативных продуктов, 8-12% для агрессивных. Высокая ставка увеличивает риск дефицита"
              />
            </div>

            <div className="input-group">
              <label title="Прогнозируемая валовая доходность инвестиционного портфеля НПФ до вычета комиссий">Ожидаемая доходность (r), % годовых</label>
              <input
                type="number"
                value={inputs.grossReturn || ''}
                onChange={handleNumberChange('grossReturn')}
                step={0.5}
                title="Основана на исторической доходности и текущей структуре портфеля. Должна превышать ставку гарантии + комиссию для безубыточности"
              />
            </div>

            <div className="input-group">
              <label title="Вознаграждение управляющей компании за управление активами. Уменьшает чистый доход клиента">Комиссия за управление (mf), % годовых</label>
              <input
                type="number"
                value={inputs.managementFee || ''}
                onChange={handleNumberChange('managementFee')}
                step={0.1}
                title="Рыночный диапазон: 0.5-2.5% годовых. Высокая комиссия при низкой доходности увеличивает вероятность дефицита"
              />
            </div>

            <div className="input-group highlight-box">
              <label title="ВАЖНО: Если включено, гарантия распространяется только на первоначальный взнос. Все последующие транши идут без гарантии, что существенно снижает риск для фонда, но уменьшает привлекательность продукта для клиента">
                <input
                  type="checkbox"
                  checked={inputs.guaranteeFirstTrancheOnly}
                  onChange={e => updateInput('guaranteeFirstTrancheOnly', e.target.checked)}
                  title="Включите для снижения риска дефицита. Рекомендуется при высокой ставке гарантии или волатильном рынке"
                />
                МГД только на первый взнос
                <span className="attention-icon" title="Важная опция: существенно влияет на расчёт гарантированного начисления">⚠️</span>
              </label>
            </div>
          </section>

          {/* Tranches */}
          <section className="input-section">
            <div className="section-header">
              <h3 title="Денежные поступления от клиентов. Каждый транш имеет дату и сумму. Более поздние транши имеют меньший time fraction">Транши</h3>
              <button className="btn-add" onClick={addTranche} title="Добавить новый транш с датой и суммой. Транши могут поступать в разные даты в течение периода">+ Добавить</button>
            </div>

            {inputs.tranches.map((t, idx) => (
              <div key={t.id} className="tranche-row" title={`Транш №${idx + 1}: дата поступления и общая сумма взносов от всех клиентов`}>
                <div className="tranche-num" title={`Порядковый номер транша. ${idx === 0 ? 'Первый транш — основной для расчёта МГД при включённой опции' : 'Дополнительный транш'}`}>{idx + 1}</div>
                <input
                  type="date"
                  value={t.date}
                  onChange={e => updateTranche(t.id, 'date', e.target.value)}
                  title="Дата поступления транша. Влияет на time fraction — чем позже дата, тем меньше доля времени участия в периоде"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={focusedInput === `tranche-${t.id}` ? (t.amount || '') : formatInputNumber(t.amount)}
                  onChange={e => {
                    const val = parseInputNumber(e.target.value)
                    updateTranche(t.id, 'amount', val)
                  }}
                  onFocus={() => setFocusedInput(`tranche-${t.id}`)}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Сумма транша"
                  title="Общая сумма взносов в рублях. Введите совокупный объём всех клиентских взносов в этот транш"
                />
                {inputs.tranches.length > 1 && (
                  <button className="btn-remove" onClick={() => removeTranche(t.id)} title="Удалить этот транш из расчёта. Минимум один транш должен остаться">×</button>
                )}
              </div>
            ))}
          </section>

          {/* Period */}
          <section className="input-section">
            <h3 title="Временной интервал для расчёта гарантированного дохода и определения time fraction траншей">Период расчёта</h3>

            <div className="input-row">
              <div className="input-group">
                <label title="Начало расчётного периода. Транши, поступившие до этой даты, учитываются с полным time fraction">Начало</label>
                <input
                  type="date"
                  value={inputs.startDate}
                  onChange={e => updateInput('startDate', e.target.value)}
                  title="Обычно — начало календарного года или дата запуска продукта. Все расчёты производятся относительно этой даты"
                />
              </div>
              <div className="input-group">
                <label title="Конец расчётного периода. На эту дату определяется итоговый дефицит/профицит">Окончание</label>
                <input
                  type="date"
                  value={inputs.endDate}
                  onChange={e => updateInput('endDate', e.target.value)}
                  title="Обычно — конец года. Период определяет yearFraction для расчёта процентов и комиссий"
                />
              </div>
            </div>

            <div className="input-group">
              <label title="Метод подсчёта дней для расчёта процентных ставок. Влияет на точность yearFraction">Конвенция дней</label>
              <select
                value={inputs.dayCountConvention}
                onChange={e => updateInput('dayCountConvention', e.target.value as 'ACT/365' | '30/360')}
                title="ACT/365 — фактические дни (точнее), 30/360 — банковская конвенция (360 дней в году, 30 дней в месяце)"
              >
                <option value="ACT/365" title="Actual/365: фактическое количество дней, делённое на 365. Стандарт для российского рынка">ACT/365</option>
                <option value="30/360" title="30/360: каждый месяц считается за 30 дней, год — 360 дней. Упрощённый расчёт для облигаций">30/360</option>
              </select>
            </div>
          </section>

          {/* Calculation Basis */}
          <section className="input-section">
            <h3 title="Методология распределения дохода и комиссий между траншами. Влияет на точность расчёта">Базис расчёта</h3>

            <div className="input-group">
              <label title="Как распределяется инвестиционный доход портфеля между траншами">Начисление дохода</label>
              <select
                value={inputs.returnApplicationBasis}
                onChange={e => updateInput('returnApplicationBasis', e.target.value as 'A' | 'B')}
                title="Выберите метод распределения валового дохода: на средневзвешенный капитал или пропорционально каждому траншу"
              >
                <option value="A" title="Доход = WeightedNAV × r × yearFrac. Простой расчёт на основе среднего капитала за период">На средний NAV</option>
                <option value="B" title="Доход рассчитывается отдельно для каждого транша с учётом его time fraction. Более точный метод">Pro-rata по траншам</option>
              </select>
            </div>

            <div className="input-group">
              <label title="Как начисляется комиссия управляющего на активы под управлением">Начисление комиссий</label>
              <select
                value={inputs.feeChargingBasis}
                onChange={e => updateInput('feeChargingBasis', e.target.value as 'A' | 'B')}
                title="Выберите метод расчёта комиссии: на средневзвешенный капитал или пропорционально каждому траншу"
              >
                <option value="A" title="Комиссия = WeightedNAV × mf × yearFrac. Стандартный подход для большинства фондов">На средний NAV</option>
                <option value="B" title="Комиссия рассчитывается для каждого транша с учётом времени участия. Справедливее для клиентов">Pro-rata по траншам</option>
              </select>
            </div>
          </section>

          {/* Monte Carlo */}
          <section className="input-section">
            <h3 title="Стохастическое моделирование для оценки вероятностного распределения дефицита при случайной доходности">Монте-Карло</h3>

            <div className="input-group checkbox-group">
              <label title="Включает симуляцию 10 000 сценариев доходности портфеля для оценки вероятности и размера дефицита">
                <input
                  type="checkbox"
                  checked={inputs.monteCarloEnabled}
                  onChange={e => updateInput('monteCarloEnabled', e.target.checked)}
                  title="При включении рассчитываются: вероятность дефицита, ожидаемый top-up, VaR 95% дефицита"
                />
                Включить симуляцию
              </label>
            </div>

            <div className="input-group">
              <label title="Стандартное отклонение годовой доходности портфеля. Определяет разброс возможных исходов в симуляции">Волатильность (σ), %</label>
              <input
                type="number"
                value={inputs.volatility || ''}
                onChange={handleNumberChange('volatility')}
                step={0.5}
                disabled={!inputs.monteCarloEnabled}
                title="Типичные значения: 3-5% для консервативных облигационных портфелей, 10-20% для акций. Историческая волатильность НПФ: 5-8%"
              />
            </div>
          </section>
        </div>
      </aside>

      {/* Main Content */}
      <main className="results-main">
        {/* Tabs */}
        <div className="results-tabs">
          <button
            className={`tab ${activeTab === 'calculator' ? 'active' : ''}`}
            onClick={() => setActiveTab('calculator')}
            title="Основной расчёт: дефицит/профицит, coverage ratio, детализация по траншам, формулы"
          >
            Расчёт
          </button>
          <button
            className={`tab ${activeTab === 'sensitivity' ? 'active' : ''}`}
            onClick={() => setActiveTab('sensitivity')}
            title="Анализ чувствительности: как изменяется дефицит при отклонении ставки гарантии, доходности и комиссии"
          >
            Чувствительность
          </button>
          <button
            className={`tab ${activeTab === 'montecarlo' ? 'active' : ''}`}
            onClick={() => setActiveTab('montecarlo')}
            disabled={!inputs.monteCarloEnabled}
            title={inputs.monteCarloEnabled ? 'Результаты симуляции Монте-Карло: вероятность дефицита, VaR, гистограмма распределения' : 'Включите симуляцию Монте-Карло в параметрах слева для доступа к этой вкладке'}
          >
            Монте-Карло
          </button>
          <button
            className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
            title="AI-рекомендации по митигации рисков: структурные изменения продукта, оптимизация комиссий, инвестиционные стратегии"
          >
            Рекомендации
          </button>
        </div>

        <div className="results-content">
          {/* Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="calculator-tab">
              {/* Summary Cards */}
              <div className="summary-cards">
                <div className={`summary-card ${results.deficit > 0 ? 'deficit' : 'surplus'}`} title={results.deficit > 0 ? 'Дефицит: чистый доход клиентам меньше гарантированного начисления. Требуется докапитализация из собственных средств фонда' : 'Профицит: чистый доход превышает гарантию. Излишек может быть направлен в резерв или распределён'}>
                  <div className="card-label">Результат</div>
                  <div className="card-value">
                    {results.deficit > 0
                      ? `Дефицит: ${formatCurrency(results.deficit)}`
                      : `Профицит: ${formatCurrency(results.surplus)}`
                    }
                  </div>
                </div>
                <div className="summary-card" title="Coverage Ratio = Чистый доход / Гарантированное начисление. Значение > 100% означает выполнение гарантии, < 100% — дефицит">
                  <div className="card-label">Coverage Ratio</div>
                  <div className="card-value">{(results.coverageRatio * 100).toFixed(1)}%</div>
                </div>
                <div className="summary-card" title="Минимальная доходность портфеля, при которой чистый доход клиентам покрывает гарантированное начисление без дефицита">
                  <div className="card-label">Безубыточная доходность</div>
                  <div className="card-value">{formatPercent(results.breakevenReturn)}</div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="results-table">
                <h3 title="Пошаговый расчёт от депозитов до итогового дефицита/профицита">Детализация расчёта</h3>
                <table>
                  <tbody>
                    <tr title="Сумма всех траншей без учёта времени участия в периоде">
                      <td>Общий депозит</td>
                      <td className="value">{formatCurrency(results.totalDeposit)}</td>
                    </tr>
                    <tr title="Сумма (транш × timeFraction). Учитывает, что поздние транши участвуют в периоде меньше времени">
                      <td>Взвешенный NAV (средний капитал)</td>
                      <td className="value">{formatCurrency(results.weightedNAV)}</td>
                    </tr>
                    <tr title="Минимальный доход, который фонд гарантирует клиентам = Σ(транш × g × timeFraction × yearFrac)">
                      <td>Гарантированное начисление</td>
                      <td className="value">{formatCurrency(results.guaranteedAccrual)}</td>
                    </tr>
                    <tr title="Инвестиционный доход портфеля до вычета комиссий = WeightedNAV × r × yearFrac">
                      <td>Валовой инвестиционный доход</td>
                      <td className="value">{formatCurrency(results.grossIncome)}</td>
                    </tr>
                    <tr title="Вознаграждение управляющей компании = WeightedNAV × mf × yearFrac">
                      <td>Комиссии</td>
                      <td className="value negative">-{formatCurrency(results.totalFees)}</td>
                    </tr>
                    <tr className="total-row" title="Доход, который получат клиенты = Валовой доход − Комиссии">
                      <td>Чистый доход клиентам</td>
                      <td className="value">{formatCurrency(results.netIncome)}</td>
                    </tr>
                    <tr className={results.deficit > 0 ? 'deficit-row' : 'surplus-row'} title={results.deficit > 0 ? 'Сумма, которую фонд должен доплатить из собственных средств для выполнения гарантии' : 'Превышение чистого дохода над гарантией. Может быть направлено в резерв'}>
                      <td>{results.deficit > 0 ? 'Дефицит (докапитализация)' : 'Профицит'}</td>
                      <td className="value">{formatCurrency(results.deficit > 0 ? results.deficit : results.surplus)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tranche Details */}
              <div className="tranche-details">
                <div className="section-header">
                  <h3 title="Расчёт для каждого транша: доля времени участия и начисленная гарантия">Детализация по траншам</h3>
                  <button
                    className="btn-toggle"
                    onClick={() => setShowFormulas(!showFormulas)}
                    title={showFormulas ? 'Скрыть математические формулы расчёта' : 'Показать математические формулы: time fraction, weighted NAV, гарантированное начисление, breakeven return'}
                  >
                    {showFormulas ? 'Скрыть формулы' : 'Показать формулы'}
                  </button>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th title="Порядковый номер транша">#</th>
                      <th title="Дата поступления транша">Дата</th>
                      <th title="Общая сумма транша в рублях">Сумма</th>
                      <th title="Доля времени участия в периоде: (дней от транша до конца) / (всего дней в периоде). 100% = транш с начала периода">Time Fraction</th>
                      <th title="Гарантированное начисление для этого транша = сумма × ставка × timeFraction × yearFrac. Если 'МГД только на первый взнос' — только первый транш">Гарантия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.trancheDetails.map((t, idx) => (
                      <tr key={t.id}>
                        <td>{idx + 1}</td>
                        <td>{t.date}</td>
                        <td>{formatCurrency(t.amount)}</td>
                        <td>{(t.timeFraction * 100).toFixed(1)}%</td>
                        <td>{formatCurrency(t.guaranteedAccrual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Formulas */}
              {showFormulas && (
                <div className="formulas-section">
                  <h3>Формулы расчёта</h3>
                  <div className="formula-block">
                    <div className="formula-name">Time Fraction (доля времени):</div>
                    <code>TF = days(trancheDate, endDate) / days(startDate, endDate)</code>
                  </div>
                  <div className="formula-block">
                    <div className="formula-name">Взвешенный NAV:</div>
                    <code>WeightedNAV = Σ(trancheAmount × timeFraction)</code>
                  </div>
                  <div className="formula-block">
                    <div className="formula-name">Гарантированное начисление:</div>
                    <code>GuaranteedAccrual = Σ(amount × g × TF × yearFrac)</code>
                  </div>
                  <div className="formula-block">
                    <div className="formula-name">Валовой доход (базис A):</div>
                    <code>GrossIncome = WeightedNAV × r × yearFrac</code>
                  </div>
                  <div className="formula-block">
                    <div className="formula-name">Дефицит:</div>
                    <code>Deficit = max(0, GuaranteedAccrual - NetIncome)</code>
                  </div>
                  <div className="formula-block">
                    <div className="formula-name">Безубыточная доходность:</div>
                    <code>r_breakeven = (Guarantee + Fees) / (WeightedNAV × yearFrac)</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sensitivity Tab */}
          {activeTab === 'sensitivity' && (
            <div className="sensitivity-tab">
              <h3>Анализ чувствительности</h3>
              <p className="tab-desc">Как изменяется дефицит при отклонении параметров от базового значения</p>

              <div className="sensitivity-grid">
                <div className="sensitivity-block">
                  <h4>Доходность портфеля (r = {inputs.grossReturn}%)</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Изменение</th>
                        <th>Значение r</th>
                        <th>Дефицит</th>
                        <th>Профицит</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivityReturn.map((p, i) => (
                        <tr key={i} className={p.delta === 0 ? 'baseline' : ''}>
                          <td>{p.delta >= 0 ? '+' : ''}{(p.delta * 100).toFixed(1)}%</td>
                          <td>{formatPercent(calcInputs.grossReturn + p.delta)}</td>
                          <td className={p.deficit > 0 ? 'negative' : ''}>{formatCurrency(p.deficit)}</td>
                          <td className={p.surplus > 0 ? 'positive' : ''}>{formatCurrency(p.surplus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="sensitivity-block">
                  <h4>Ставка гарантии (g = {inputs.guaranteeRate}%)</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Изменение</th>
                        <th>Значение g</th>
                        <th>Дефицит</th>
                        <th>Профицит</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivityGuarantee.map((p, i) => (
                        <tr key={i} className={p.delta === 0 ? 'baseline' : ''}>
                          <td>{p.delta >= 0 ? '+' : ''}{(p.delta * 100).toFixed(1)}%</td>
                          <td>{formatPercent(calcInputs.guaranteeRate + p.delta)}</td>
                          <td className={p.deficit > 0 ? 'negative' : ''}>{formatCurrency(p.deficit)}</td>
                          <td className={p.surplus > 0 ? 'positive' : ''}>{formatCurrency(p.surplus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="sensitivity-block">
                  <h4>Комиссия за управление (mf = {inputs.managementFee}%)</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Изменение</th>
                        <th>Значение mf</th>
                        <th>Дефицит</th>
                        <th>Профицит</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivityFee.map((p, i) => (
                        <tr key={i} className={p.delta === 0 ? 'baseline' : ''}>
                          <td>{p.delta >= 0 ? '+' : ''}{(p.delta * 100).toFixed(2)}%</td>
                          <td>{formatPercent(calcInputs.managementFee + p.delta)}</td>
                          <td className={p.deficit > 0 ? 'negative' : ''}>{formatCurrency(p.deficit)}</td>
                          <td className={p.surplus > 0 ? 'positive' : ''}>{formatCurrency(p.surplus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Monte Carlo Tab */}
          {activeTab === 'montecarlo' && monteCarloResults && (
            <div className="montecarlo-tab">
              <h3>Симуляция Монте-Карло</h3>
              <p className="tab-desc">
                {formatNumber(inputs.monteCarloSims)} симуляций с волатильностью σ = {inputs.volatility}%
              </p>

              <div className="mc-summary">
                <div className="mc-card" title="Доля симуляций, в которых возник дефицит. Значение > 30% — повышенный риск, > 50% — критический уровень">
                  <div className="mc-label">Вероятность дефицита</div>
                  <div className={`mc-value ${monteCarloResults.probDeficit > 0.3 ? 'warning' : ''}`}>
                    {(monteCarloResults.probDeficit * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="mc-card" title="Математическое ожидание дефицита: средний размер докапитализации по всем симуляциям (включая нулевые)">
                  <div className="mc-label">Ожидаемый top-up</div>
                  <div className="mc-value">{formatCurrency(monteCarloResults.expectedTopUp)}</div>
                </div>
                <div className="mc-card" title="Value at Risk 95%: максимальный дефицит с вероятностью 95%. В 5% случаев дефицит может быть выше этой суммы">
                  <div className="mc-label">VaR 95% (top-up)</div>
                  <div className="mc-value">{formatCurrency(monteCarloResults.var95TopUp)}</div>
                </div>
              </div>

              {/* Simple histogram */}
              <div className="histogram-section">
                <h4>Распределение дефицита</h4>
                <div className="histogram">
                  {(() => {
                    const buckets = 20
                    const max = Math.max(...monteCarloResults.simResults)
                    const bucketSize = max / buckets
                    const counts = Array(buckets).fill(0)
                    monteCarloResults.simResults.forEach(v => {
                      const idx = Math.min(Math.floor(v / bucketSize), buckets - 1)
                      counts[idx]++
                    })
                    const maxCount = Math.max(...counts)
                    return counts.map((c, i) => (
                      <div key={i} className="histogram-bar-container">
                        <div
                          className="histogram-bar"
                          style={{ height: `${(c / maxCount) * 100}%` }}
                          title={`${formatCurrency(i * bucketSize)} - ${formatCurrency((i + 1) * bucketSize)}: ${c} симуляций`}
                        />
                      </div>
                    ))
                  })()}
                </div>
                <div className="histogram-labels">
                  <span>0</span>
                  <span>{formatCurrency(Math.max(...monteCarloResults.simResults) / 2)}</span>
                  <span>{formatCurrency(Math.max(...monteCarloResults.simResults))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div className="recommendations-tab">
              <h3>Рекомендации по митигации рисков</h3>
              <p className="tab-desc">
                На основе текущих параметров и результатов расчёта
              </p>

              <div className="recommendations-list">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className={`recommendation-item priority-${rec.priority}`}>
                    <div className="rec-header">
                      <span className="rec-icon">{getCategoryIcon(rec.category)}</span>
                      <span className="rec-priority" style={{ color: getPriorityColor(rec.priority) }}>
                        {rec.priority === 'high' ? 'Высокий' : rec.priority === 'medium' ? 'Средний' : 'Низкий'}
                      </span>
                    </div>
                    <div className="rec-text">{rec.text}</div>
                  </div>
                ))}
              </div>

              <div className="assumptions-section">
                <h4>Допущения модели</h4>
                <ul>
                  <li>Доходность портфеля следует нормальному распределению (для Монте-Карло)</li>
                  <li>Комиссии начисляются на конец периода</li>
                  <li>Нет досрочных изъятий в течение периода</li>
                  <li>Все транши от всех клиентов идентичны</li>
                  <li>Налоги и операционные расходы не учитываются</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .models-wrapper {
          position: fixed;
          top: 73px;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          background: #f5f5f7;
        }

        /* Left Panel - Inputs (Compact) */
        .inputs-panel {
          width: 300px;
          background: #1a1a2e;
          color: #fff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .panel-title {
          font-size: 13px;
          font-weight: 600;
        }
        .btn-reset {
          background: none;
          border: none;
          color: #888;
          font-size: 16px;
          cursor: pointer;
        }
        .btn-reset:hover { color: #fff; }

        .inputs-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px;
        }

        .input-section {
          margin-bottom: 14px;
        }
        .input-section h3 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
          margin: 0 0 6px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .section-header h3 { margin: 0; }

        .input-group {
          margin-bottom: 8px;
        }
        .input-group label {
          display: block;
          font-size: 11px;
          color: #aaa;
          margin-bottom: 2px;
        }
        .input-group input,
        .input-group select {
          width: 100%;
          padding: 5px 8px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          color: #fff;
          font-size: 12px;
        }
        .input-group input[type="number"] {
          text-align: left;
          padding-left: 10px;
        }
        .input-group input[type="date"] {
          text-align: left;
        }
        .input-group input:focus,
        .input-group select:focus {
          outline: none;
          border-color: var(--primary);
        }
        .input-group input:disabled {
          opacity: 0.5;
        }

        .input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .checkbox-group label,
        .highlight-box label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 11px;
        }
        .checkbox-group input[type="checkbox"],
        .highlight-box input[type="checkbox"] {
          width: auto;
        }
        .highlight-box {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 6px;
          padding: 8px 10px;
          margin-top: 4px;
        }
        .highlight-box label {
          color: #a5b4fc;
          justify-content: space-between;
          width: 100%;
        }
        .attention-icon {
          font-size: 14px;
          margin-left: auto;
        }

        .tranche-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 4px;
        }
        .tranche-num {
          width: 18px;
          height: 18px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #888;
          flex-shrink: 0;
        }
        .tranche-row input {
          flex: 1;
          min-width: 0;
          padding: 4px 6px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 3px;
          color: #fff;
          font-size: 11px;
        }
        .tranche-row input[type="date"] {
          width: 110px;
          flex: none;
        }
        .tranche-row input[type="text"] {
          text-align: right;
        }
        .btn-add, .btn-remove {
          padding: 3px 6px;
          border: none;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
        }
        .btn-add {
          background: var(--primary);
          color: #fff;
        }
        .btn-remove {
          background: #ef4444;
          color: #fff;
          padding: 3px 5px;
        }

        /* Main Area */
        .results-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }

        .results-tabs {
          display: flex;
          gap: 4px;
          padding: 12px 20px;
          background: #fff;
          border-bottom: 1px solid var(--border);
        }
        .tab {
          padding: 8px 16px;
          border: none;
          background: none;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .tab:hover {
          background: #f5f5f5;
        }
        .tab.active {
          background: var(--primary);
          color: #fff;
        }
        .tab:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .results-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        /* Calculator Tab */
        .calculator-tab h3 {
          font-size: 14px;
          margin: 0 0 12px;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .summary-card {
          background: #fff;
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .summary-card.deficit {
          border-left: 4px solid #ef4444;
        }
        .summary-card.surplus {
          border-left: 4px solid #22c55e;
        }
        .card-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .card-value {
          font-size: 18px;
          font-weight: 700;
        }

        .results-table, .tranche-details {
          background: #fff;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .results-table table, .tranche-details table {
          width: 100%;
          border-collapse: collapse;
        }
        .results-table td, .tranche-details td, .tranche-details th {
          padding: 10px 8px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 13px;
        }
        .results-table .value, .tranche-details td {
          text-align: right;
          font-family: monospace;
        }
        .results-table .negative { color: #ef4444; }
        .results-table .total-row {
          font-weight: 600;
          background: #f8f9fa;
        }
        .results-table .deficit-row {
          background: #fef2f2;
          color: #dc2626;
          font-weight: 600;
        }
        .results-table .surplus-row {
          background: #f0fdf4;
          color: #16a34a;
          font-weight: 600;
        }

        .tranche-details th {
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          font-size: 11px;
          text-transform: uppercase;
        }

        .btn-toggle {
          padding: 4px 10px;
          border: 1px solid var(--border);
          background: #fff;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        .formulas-section {
          background: #1e1e2e;
          border-radius: 10px;
          padding: 16px;
          color: #fff;
        }
        .formulas-section h3 {
          color: #fff;
          margin-bottom: 16px;
        }
        .formula-block {
          margin-bottom: 12px;
        }
        .formula-name {
          font-size: 11px;
          color: #888;
          margin-bottom: 4px;
        }
        .formula-block code {
          display: block;
          background: rgba(255,255,255,0.05);
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          color: #4ade80;
        }

        /* Sensitivity Tab */
        .sensitivity-tab h3, .montecarlo-tab h3, .recommendations-tab h3 {
          font-size: 18px;
          margin: 0 0 8px;
        }
        .tab-desc {
          color: var(--text-muted);
          font-size: 13px;
          margin: 0 0 24px;
        }

        .sensitivity-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 16px;
        }
        .sensitivity-block {
          background: #fff;
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .sensitivity-block h4 {
          font-size: 13px;
          margin: 0 0 12px;
        }
        .sensitivity-block table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .sensitivity-block th, .sensitivity-block td {
          padding: 8px;
          text-align: right;
          border-bottom: 1px solid #f0f0f0;
        }
        .sensitivity-block th {
          font-weight: 600;
          color: var(--text-muted);
          font-size: 10px;
          text-transform: uppercase;
        }
        .sensitivity-block .baseline {
          background: #fffbeb;
          font-weight: 600;
        }
        .sensitivity-block .negative { color: #ef4444; }
        .sensitivity-block .positive { color: #22c55e; }

        /* Monte Carlo Tab */
        .mc-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .mc-card {
          background: #fff;
          border-radius: 10px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .mc-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .mc-value {
          font-size: 24px;
          font-weight: 700;
        }
        .mc-value.warning { color: #f59e0b; }

        .histogram-section {
          background: #fff;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .histogram-section h4 {
          margin: 0 0 16px;
          font-size: 14px;
        }
        .histogram {
          display: flex;
          align-items: flex-end;
          height: 150px;
          gap: 2px;
        }
        .histogram-bar-container {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: flex-end;
        }
        .histogram-bar {
          width: 100%;
          background: linear-gradient(180deg, #6366f1, #4f46e5);
          border-radius: 2px 2px 0 0;
          min-height: 2px;
        }
        .histogram-labels {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 8px;
        }

        /* Recommendations Tab */
        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        .recommendation-item {
          background: #fff;
          border-radius: 8px;
          padding: 14px 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid;
        }
        .recommendation-item.priority-high { border-color: #ef4444; }
        .recommendation-item.priority-medium { border-color: #f59e0b; }
        .recommendation-item.priority-low { border-color: #6b7280; }
        .rec-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .rec-icon { font-size: 14px; }
        .rec-priority {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .rec-text {
          font-size: 13px;
          line-height: 1.5;
        }

        .assumptions-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }
        .assumptions-section h4 {
          font-size: 13px;
          margin: 0 0 12px;
        }
        .assumptions-section ul {
          margin: 0;
          padding-left: 20px;
        }
        .assumptions-section li {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .summary-cards, .mc-summary {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 800px) {
          .inputs-panel {
            width: 280px;
          }
        }
      `}</style>
    </div>
  )
}

export default Models
