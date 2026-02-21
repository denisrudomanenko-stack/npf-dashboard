// Financial Models Types

export type ModelCategory = 'calculators' | 'stress-tests' | 'forecasting'

export interface ModelDefinition {
  id: string
  name: string
  icon: string
  category: ModelCategory
  description?: string
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
  {
    id: 'mgd',
    name: 'Калькулятор МГД',
    icon: '📊',
    category: 'calculators',
    description: 'Расчёт минимальной гарантированной доходности'
  },
  {
    id: 'unit-economics',
    name: 'Unit-экономика',
    icon: '💰',
    category: 'calculators',
    description: 'Анализ экономики на клиента'
  },
  {
    id: 'stress-test',
    name: 'Стресс-тестирование',
    icon: '⚡',
    category: 'stress-tests',
    description: 'Сценарный анализ портфеля'
  },
  {
    id: 'forecast',
    name: 'Прогнозирование',
    icon: '📈',
    category: 'forecasting',
    description: 'Прогноз сборов и участников'
  },
]

export const MODEL_CATEGORIES: Record<ModelCategory, string> = {
  'calculators': 'Калькуляторы',
  'stress-tests': 'Стресс-тесты',
  'forecasting': 'Прогнозирование'
}
