# Реализованный функционал

## Обзор модулей

```
┌─────────────────────────────────────────────────────────────┐
│                    NPF Development Platform                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐ │
│  │Dashboard│ │Enterpr. │ │ Roadmap │ │Documents│ │  Chat │ │
│  │   KPI   │ │   CRM   │ │ Gantt   │ │   RAG   │ │  AI   │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Дашборд

### Описание
Центральная страница с ключевыми метриками и визуализациями состояния проекта.

### Функции

#### KPI-карточки
- **Сборы КПП** — текущие/плановые (млрд руб)
- **Участники Банка** — текущие/плановые (человек)
- **Предприятия** — в работе/всего
- **Прогресс плана** — процент выполнения

#### Диаграмма реализации проектов (Timeline)
- Визуализация задач по кварталам (Q1-Q4 2026)
- Цветовая индикация статуса:
  - Зелёный — завершено
  - Оранжевый — в работе
  - Серый — запланировано
- Индикация трека (внутренний/внешний/оба)
- Линия текущей даты
- CRUD-операции с задачами:
  - Добавление через модальное окно
  - Редактирование
  - Архивирование с подтверждением
  - Удаление с подтверждением
- Архив задач с возможностью восстановления

#### Pipeline предприятий
- Группировка по категориям:
  - **A** — Быстрые победы
  - **B** — Рабочие кейсы
  - **В** — Длинные проекты
  - **Г** — Заморозка
- Прогресс-бары заполненности категорий
- Список топ-3 предприятий в категории

#### Воронка продаж
- Этапы: Первый контакт → Презентация → Переговоры → Договор → Запущено
- Визуализация сужения воронки
- Количество предприятий на каждом этапе

#### Матрица рисков
- Сетка 3×4 (вероятность × влияние)
- Цветовая индикация severity (low/medium/high)
- Интерактивные метки рисков
- Список рисков с описанием митигации

#### Ключевые вехи 2026
- Хронологический список milestones
- Статусы: завершено, в работе, запланировано
- Индикатор текущей вехи

### API Endpoints
```
GET  /api/v1/dashboard/           # Все данные дашборда
POST /api/v1/dashboard/tasks      # Создать задачу
PATCH /api/v1/dashboard/tasks/{id} # Обновить задачу
DELETE /api/v1/dashboard/tasks/{id} # Удалить задачу
POST /api/v1/dashboard/tasks/{id}/archive # Архивировать
GET  /api/v1/dashboard/tasks/archived # Архив задач
POST /api/v1/dashboard/seed       # Заполнить тестовыми данными
```

---

## 2. Управление предприятиями

### Описание
CRM-модуль для ведения базы корпоративных клиентов.

### Функции

#### Список предприятий
- Табличное представление с пагинацией
- Сортировка по колонкам
- Фильтрация по:
  - Статусу (Prospect, Negotiation, Pilot, Active, Inactive)
  - Категории (A, B, V, G)
  - Этапу продаж

#### Карточка предприятия
- Основная информация:
  - Название, отрасль
  - Количество сотрудников
  - Проникновение банка (%)
- Классификация:
  - Категория приоритета (A/B/V/G)
  - Скоринговый балл (0-100)
  - Статус в воронке продаж
- Контактные данные:
  - Контактное лицо
  - Email, телефон
- Локации
- Заметки

#### CRUD-операции
- Создание предприятия
- Редактирование
- Удаление
- Импорт из Excel/CSV

### Модель данных

```python
class Enterprise:
    id: int
    name: str
    industry: str
    employee_count: int
    bank_penetration: float
    status: EnterpriseStatus  # PROSPECT|NEGOTIATION|PILOT|ACTIVE|INACTIVE
    category: EnterpriseCategory  # A|B|V|G
    sales_status: SalesStatus  # CONTACT|PRESENTATION|NEGOTIATION|CONTRACT|LAUNCHED
    score: int  # 0-100
    locations: str
    contact_person: str
    contact_email: str
    contact_phone: str
    notes: str
```

### API Endpoints
```
GET    /api/v1/enterprises/       # Список с фильтрами
GET    /api/v1/enterprises/{id}   # Карточка
POST   /api/v1/enterprises/       # Создать
PUT    /api/v1/enterprises/{id}   # Обновить
DELETE /api/v1/enterprises/{id}   # Удалить
POST   /api/v1/enterprises/import # Импорт из файла
```

---

## 3. Дорожная карта

### Описание
Управление задачами развития с визуализацией по кварталам.

### Функции

#### Визуализация
- Gantt-подобная диаграмма
- Группировка по трекам:
  - Трек 1: Сотрудники Банка (internal)
  - Трек 2: Внешние клиенты (external)
- Квартальная разбивка (Q1-Q4)
- Цветовая индикация статуса

#### Управление задачами
- Создание с указанием:
  - Название, описание
  - Трек
  - Даты начала/окончания
  - Квартал, год
  - Приоритет
  - Ответственный
- Редактирование
- Изменение статуса
- Удаление

#### Статусы задач
- `PLANNED` — Запланировано
- `IN_PROGRESS` — В работе
- `COMPLETED` — Завершено
- `BLOCKED` — Заблокировано
- `CANCELLED` — Отменено

### Модель данных

```python
class RoadmapItem:
    id: int
    title: str
    description: str
    track: Track  # INTERNAL_PILOT|EXTERNAL_CLIENTS
    status: RoadmapStatus
    start_date: date
    end_date: date
    quarter: int  # 1-4
    year: int
    priority: int
    dependencies: list[int]  # JSON
    responsible: str
```

### API Endpoints
```
GET    /api/v1/roadmap/           # Список с фильтрами
GET    /api/v1/roadmap/by-track/{track} # По треку
GET    /api/v1/roadmap/{id}       # Детали
POST   /api/v1/roadmap/           # Создать
PUT    /api/v1/roadmap/{id}       # Обновить
DELETE /api/v1/roadmap/{id}       # Удалить
PATCH  /api/v1/roadmap/{id}/status # Изменить статус
```

---

## 4. База знаний (Документы + RAG)

### Описание
Система управления документами с автоматической индексацией для RAG-поиска.

### Функции

#### Загрузка документов
- Drag-and-drop интерфейс
- Поддерживаемые форматы:
  - PDF (с OCR для сканов)
  - DOCX
  - XLSX, XLS, CSV
  - TXT, MD
- Автоматическая индексация в ChromaDB
- Дедупликация по SHA-256 хешу

#### Управление документами
- Список с фильтрацией:
  - По типу документа
  - По статусу (Active, Archived, Deleted)
- Типы документов:
  - Regulation — Нормативные документы
  - Product — Описание продуктов
  - Presentation — Презентации
  - Contract Template — Шаблоны договоров
  - Analytics — Аналитика
  - FAQ — Вопросы-ответы
  - Other — Прочее
- Переименование
- Смена категории
- Архивирование
- Удаление (soft delete)
- Скачивание

#### Индексация
- Автоматическая при загрузке
- Ручная переиндексация
- Настраиваемый chunking по типу документа
- Статистика: количество чанков, дата индексации

#### OCR
- Распознавание текста из PDF через Claude Vision
- Автоматическое определение языка

#### AI-функции
- Автоматическое предложение имени документа
- Генерация описания

### Модель данных

```python
class Document:
    id: int
    filename: str
    original_filename: str
    file_path: str
    file_type: str  # pdf|docx|xlsx|csv|txt|md
    document_type: DocumentType
    title: str
    description: str
    content_hash: str  # SHA-256
    status: DocumentStatus  # ACTIVE|ARCHIVED|DELETED
    indexed_at: datetime
    chunk_count: int
```

### API Endpoints
```
GET    /api/v1/documents/         # Список
GET    /api/v1/documents/indexed  # Проиндексированные
GET    /api/v1/documents/types    # Типы с настройками chunking
GET    /api/v1/documents/stats    # Статистика БЗ
POST   /api/v1/documents/upload   # Загрузка файла
POST   /api/v1/documents/add-text # Добавить текст
POST   /api/v1/documents/search   # Поиск
POST   /api/v1/documents/{id}/reindex # Переиндексировать
PATCH  /api/v1/documents/{id}/archive # Архивировать
DELETE /api/v1/documents/{id}     # Удалить
GET    /api/v1/documents/{id}/download # Скачать
POST   /api/v1/documents/{id}/suggest-name # AI-имя
PATCH  /api/v1/documents/{id}/rename # Переименовать
PATCH  /api/v1/documents/{id}/category # Сменить тип
POST   /api/v1/documents/{id}/ocr # OCR PDF
```

---

## 5. AI-ассистент (Чат)

### Описание
Интерфейс для общения с AI с возможностью использования базы знаний.

### Функции

#### Разговоры
- Создание новых разговоров
- Список разговоров (sidebar)
- Автоматическое именование
- Удаление разговора
- Очистка истории сообщений

#### Чат
- Отправка сообщений
- Streaming-ответы (Server-Sent Events)
- Переключатель RAG-режима:
  - **Включён**: ответы на основе базы знаний
  - **Выключён**: общий чат с LLM
- Отображение источников (при RAG)
- История сообщений

#### RAG-поиск
- Векторный поиск по базе знаний
- Top-K релевантных документов
- Фильтрация по типу документа
- Отображение релевантности источников

### Модель данных

```python
class Conversation:
    id: int
    title: str
    is_archived: bool
    created_at: datetime
    messages: list[ChatMessage]

class ChatMessage:
    id: int
    conversation_id: int
    role: str  # "user"|"assistant"
    content: str
    use_rag: bool
    created_at: datetime
```

### API Endpoints
```
GET    /api/v1/conversations/     # Список разговоров
POST   /api/v1/conversations/     # Создать
GET    /api/v1/conversations/{id} # Получить с сообщениями
DELETE /api/v1/conversations/{id} # Удалить
PATCH  /api/v1/conversations/{id}/title # Переименовать
POST   /api/v1/conversations/{id}/chat # Отправить сообщение
DELETE /api/v1/conversations/{id}/messages # Очистить

# RAG API
POST   /api/v1/rag/query          # Запрос с генерацией ответа
POST   /api/v1/rag/search         # Только поиск
POST   /api/v1/rag/chat           # Чат (single-turn)
POST   /api/v1/rag/chat/stream    # Streaming чат
GET    /api/v1/rag/context        # Получить контекст
GET    /api/v1/rag/stats          # Статистика RAG
```

---

## 6. Настройки LLM

### Описание
Конфигурация AI-моделей для различных функций системы.

### Функции

#### Настройка моделей
- Выбор провайдера (Ollama / Anthropic)
- Выбор модели для каждой функции:
  - **Chat** — генерация ответов
  - **Vision** — OCR и анализ изображений
  - **Embeddings** — векторизация текста
- Сохранение в БД
- Применение без перезапуска

#### Диагностика
- Проверка доступности Ollama
- Список доступных моделей
- Тестирование embedding

### Модель данных

```python
class LLMConfig:
    id: int
    function: str  # "chat"|"vision"|"embeddings"
    provider: str  # "ollama"|"anthropic"
    model: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

### API Endpoints
```
GET  /api/v1/rag/llm-config       # Текущая конфигурация
POST /api/v1/rag/llm-config       # Обновить
POST /api/v1/rag/llm-config/reset # Сбросить к defaults
POST /api/v1/rag/test-embedding   # Тест embedding
```

---

## 7. Системные функции

### Health Checks
```
GET /health           # Простая проверка
GET /api/v1/health    # Версия API
```

### Статические файлы (Production)
- SPA index.html для всех не-API маршрутов
- Статика из `/assets`

### Middleware
- CORS для разрешённых origins
- Автоматическая загрузка LLM конфигурации при старте

---

## Матрица функционала

| Модуль | CRUD | Фильтры | Импорт | AI | Визуализация |
|--------|:----:|:-------:|:------:|:--:|:------------:|
| Dashboard | + | + | - | - | + |
| Enterprises | + | + | + | - | + |
| Roadmap | + | + | - | - | + |
| Documents | + | + | + | + | - |
| Chat | + | - | - | + | - |
| LLM Settings | + | - | - | - | - |

## Статус реализации

| Функция | Статус | Примечание |
|---------|--------|------------|
| Dashboard KPI | ✅ Готово | Данные из БД |
| Dashboard Timeline | ✅ Готово | CRUD + архив |
| Dashboard Pipeline | ✅ Готово | Группировка по категориям |
| Dashboard Funnel | ✅ Готово | Агрегация из enterprises |
| Dashboard Risks | ✅ Готово | Матрица + список |
| Dashboard Milestones | ✅ Готово | Список с статусами |
| Enterprises CRUD | ✅ Готово | Полный функционал |
| Enterprises Import | ✅ Готово | Excel/CSV |
| Roadmap CRUD | ✅ Готово | Полный функционал |
| Documents Upload | ✅ Готово | Все форматы |
| Documents RAG | ✅ Готово | ChromaDB |
| Documents OCR | ✅ Готово | Claude Vision |
| Chat Conversations | ✅ Готово | Полный функционал |
| Chat Streaming | ✅ Готово | SSE |
| Chat RAG | ✅ Готово | Toggle режим |
| LLM Settings | ✅ Готово | Runtime switch |
| Authentication | ⏳ Подготовлено | JWT структура готова |
| Notifications | ❌ Не реализовано | - |
| Reports Export | ❌ Не реализовано | - |
