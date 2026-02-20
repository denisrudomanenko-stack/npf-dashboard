# API Documentation

## Общая информация

- **Base URL**: `/api/v1`
- **Формат данных**: JSON
- **Кодировка**: UTF-8
- **Аутентификация**: Подготовлена (JWT), не активирована

## Статусы ответов

| Код | Описание |
|-----|----------|
| 200 | Успешный запрос |
| 201 | Ресурс создан |
| 400 | Ошибка валидации |
| 404 | Ресурс не найден |
| 422 | Ошибка обработки данных |
| 500 | Внутренняя ошибка сервера |

---

## Health Endpoints

### GET /health
Простая проверка работоспособности.

**Response:**
```json
{
  "status": "healthy"
}
```

### GET /api/v1/health
Информация о версии API.

**Response:**
```json
{
  "status": "healthy",
  "api": "NPF Development API",
  "version": "0.1.0"
}
```

---

## Enterprises API

### GET /api/v1/enterprises/
Список предприятий с фильтрацией.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| status | string | Фильтр по статусу |
| category | string | Фильтр по категории (A/B/V/G) |
| skip | int | Пропустить N записей (default: 0) |
| limit | int | Максимум записей (default: 100) |

**Response:**
```json
[
  {
    "id": 1,
    "name": "ПАО Сбербанк",
    "industry": "Финансы",
    "employee_count": 250000,
    "bank_penetration": 15.5,
    "status": "active",
    "category": "A",
    "sales_status": "launched",
    "score": 85,
    "locations": "Москва, Санкт-Петербург",
    "contact_person": "Иванов И.И.",
    "contact_email": "ivanov@sber.ru",
    "contact_phone": "+7 495 123-45-67",
    "notes": "",
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-02-10T14:20:00Z"
  }
]
```

### GET /api/v1/enterprises/{id}
Получить предприятие по ID.

### POST /api/v1/enterprises/
Создать предприятие.

**Request Body:**
```json
{
  "name": "ООО Газпром",
  "industry": "Энергетика",
  "employee_count": 500000,
  "category": "A",
  "sales_status": "contact",
  "score": 90
}
```

### PUT /api/v1/enterprises/{id}
Обновить предприятие.

### DELETE /api/v1/enterprises/{id}
Удалить предприятие.

### POST /api/v1/enterprises/import
Импорт из Excel/CSV.

**Content-Type:** `multipart/form-data`

**Form Data:**
| Поле | Тип | Описание |
|------|-----|----------|
| file | file | Excel (.xlsx, .xls) или CSV файл |

---

## Roadmap API

### GET /api/v1/roadmap/
Список задач дорожной карты.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| track | string | internal_pilot / external_clients |
| status | string | planned / in_progress / completed / blocked |
| year | int | Год (default: 2026) |
| skip | int | Пропустить N записей |
| limit | int | Максимум записей |

**Response:**
```json
[
  {
    "id": 1,
    "title": "Запуск пилота на 3 предприятиях",
    "description": "Первая волна пилотных проектов",
    "track": "external_clients",
    "status": "in_progress",
    "start_date": "2026-01-15",
    "end_date": "2026-03-31",
    "quarter": 1,
    "year": 2026,
    "priority": 1,
    "dependencies": [],
    "responsible": "Петров П.П.",
    "created_at": "2026-01-10T09:00:00Z",
    "updated_at": "2026-02-01T11:30:00Z"
  }
]
```

### GET /api/v1/roadmap/by-track/{track}
Фильтр по треку.

**Path Parameters:**
- `track`: `internal_pilot` | `external_clients`

### GET /api/v1/roadmap/{id}
Получить задачу по ID.

### POST /api/v1/roadmap/
Создать задачу.

**Request Body:**
```json
{
  "title": "Интеграция с HR-системой",
  "description": "Автоматизация подключения сотрудников",
  "track": "internal_pilot",
  "status": "planned",
  "start_date": "2026-04-01",
  "end_date": "2026-06-30",
  "quarter": 2,
  "year": 2026,
  "priority": 2,
  "responsible": "Сидоров С.С."
}
```

### PUT /api/v1/roadmap/{id}
Обновить задачу.

### DELETE /api/v1/roadmap/{id}
Удалить задачу.

### PATCH /api/v1/roadmap/{id}/status
Изменить статус задачи.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| status | string | Новый статус |

---

## Documents API

### GET /api/v1/documents/
Список документов.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| status | string | active / archived / deleted |
| document_type | string | Тип документа |
| skip | int | Пропустить N записей |
| limit | int | Максимум записей |

**Response:**
```json
[
  {
    "id": 1,
    "filename": "policy_2026.pdf",
    "original_filename": "Политика НПФ 2026.pdf",
    "file_type": "pdf",
    "document_type": "regulation",
    "title": "Политика корпоративного пенсионного обеспечения",
    "description": "Основной нормативный документ",
    "content_hash": "a1b2c3d4...",
    "status": "active",
    "indexed_at": "2026-01-20T15:00:00Z",
    "chunk_count": 45,
    "created_at": "2026-01-20T14:55:00Z"
  }
]
```

### GET /api/v1/documents/indexed
Проиндексированные документы в RAG.

### GET /api/v1/documents/types
Типы документов с настройками chunking.

**Response:**
```json
{
  "regulation": {
    "label": "Нормативные документы",
    "chunk_size": 800,
    "chunk_overlap": 80
  },
  "product": {
    "label": "Описание продуктов",
    "chunk_size": 1000,
    "chunk_overlap": 100
  }
}
```

### GET /api/v1/documents/stats
Статистика базы знаний.

**Response:**
```json
{
  "total_documents": 25,
  "indexed_documents": 23,
  "total_chunks": 1250,
  "by_type": {
    "regulation": 5,
    "product": 8,
    "presentation": 10,
    "other": 2
  }
}
```

### POST /api/v1/documents/upload
Загрузка и индексация файла.

**Content-Type:** `multipart/form-data`

**Form Data:**
| Поле | Тип | Описание |
|------|-----|----------|
| file | file | Файл документа |
| document_type | string | Тип документа (optional) |
| title | string | Название (optional) |

**Response:**
```json
{
  "id": 10,
  "filename": "doc_123.pdf",
  "original_filename": "Презентация КПП.pdf",
  "document_type": "presentation",
  "chunk_count": 12,
  "indexed_at": "2026-02-19T10:30:00Z"
}
```

### POST /api/v1/documents/add-text
Добавить текст напрямую в базу знаний.

**Request Body:**
```json
{
  "title": "FAQ по КПП",
  "content": "Вопрос: Что такое КПП?\nОтвет: Корпоративная пенсионная программа...",
  "document_type": "faq"
}
```

### POST /api/v1/documents/search
Поиск по базе знаний.

**Request Body:**
```json
{
  "query": "условия подключения к программе",
  "top_k": 5,
  "document_type": "regulation"
}
```

**Response:**
```json
{
  "results": [
    {
      "document_id": "doc_5",
      "content": "Для подключения к программе необходимо...",
      "relevance": 0.89,
      "metadata": {
        "source": "policy_2026.pdf",
        "page": 12
      }
    }
  ]
}
```

### POST /api/v1/documents/{id}/reindex
Переиндексировать документ.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| document_type | string | Новый тип (optional) |

### PATCH /api/v1/documents/{id}/archive
Архивировать документ.

### DELETE /api/v1/documents/{id}
Мягкое удаление документа.

### DELETE /api/v1/documents/indexed/{doc_id}
Удалить из RAG-индекса.

### GET /api/v1/documents/{id}/download
Скачать файл документа.

### POST /api/v1/documents/{id}/suggest-name
AI-предложение имени документа.

**Response:**
```json
{
  "suggested_name": "Политика КПО 2026 - Основные положения"
}
```

### PATCH /api/v1/documents/{id}/rename
Переименовать документ.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| new_name | string | Новое имя файла |

### PATCH /api/v1/documents/{id}/category
Изменить тип документа.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| document_type | string | Новый тип |

### POST /api/v1/documents/{id}/ocr
OCR для PDF через Claude Vision.

**Response:**
```json
{
  "text": "Распознанный текст документа...",
  "pages_processed": 5
}
```

---

## RAG API

### POST /api/v1/rag/query
Запрос с генерацией ответа.

**Request Body:**
```json
{
  "query": "Какие преимущества программы КПП для сотрудников?",
  "top_k": 5,
  "document_type": null
}
```

**Response:**
```json
{
  "answer": "Программа КПП предоставляет сотрудникам следующие преимущества:\n1. Дополнительное пенсионное обеспечение...",
  "sources": [
    {
      "document_id": "doc_3",
      "content": "Преимущества для сотрудников включают...",
      "relevance": 0.92,
      "metadata": {
        "source": "benefits.pdf",
        "document_type": "product"
      }
    }
  ]
}
```

### POST /api/v1/rag/search
Только векторный поиск (без генерации).

**Request Body:**
```json
{
  "query": "условия договора",
  "top_k": 10
}
```

### POST /api/v1/rag/chat
Single-turn чат с опциональным RAG.

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "Расскажи о тарифах КПП"}
  ],
  "use_rag": true
}
```

### POST /api/v1/rag/chat/stream
Streaming чат (Server-Sent Events).

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "Объясни процесс подключения"}
  ],
  "use_rag": true
}
```

**Response (SSE):**
```
data: {"token": "Процесс"}
data: {"token": " подключения"}
data: {"token": " включает"}
...
data: [DONE]
```

### GET /api/v1/rag/context
Получить контекст для запроса.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| query | string | Текст запроса |
| top_k | int | Количество результатов |

### GET /api/v1/rag/stats
Статистика RAG-системы.

**Response:**
```json
{
  "total_documents": 23,
  "total_chunks": 1250,
  "embedding_model": "nomic-embed-text",
  "chat_model": "qwen2.5:7b",
  "provider": "ollama"
}
```

### POST /api/v1/rag/test-embedding
Тестирование embedding.

**Request Body:**
```json
{
  "text": "Тестовый текст для векторизации"
}
```

**Response:**
```json
{
  "embedding_length": 768,
  "first_values": [0.123, -0.456, 0.789]
}
```

### GET /api/v1/rag/llm-config
Текущая конфигурация LLM.

**Response:**
```json
{
  "chat": {
    "provider": "ollama",
    "model": "qwen2.5:7b"
  },
  "embeddings": {
    "provider": "ollama",
    "model": "nomic-embed-text"
  },
  "vision": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

### POST /api/v1/rag/llm-config
Обновить конфигурацию.

**Request Body:**
```json
{
  "function": "chat",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514"
}
```

### POST /api/v1/rag/llm-config/reset
Сбросить к настройкам по умолчанию.

---

## Conversations API

### GET /api/v1/conversations/
Список разговоров.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Вопросы по тарифам",
    "is_archived": false,
    "created_at": "2026-02-18T14:00:00Z",
    "updated_at": "2026-02-19T09:30:00Z"
  }
]
```

### POST /api/v1/conversations/
Создать разговор.

**Response:**
```json
{
  "id": 5,
  "title": "Новый разговор",
  "is_archived": false,
  "created_at": "2026-02-19T10:00:00Z"
}
```

### GET /api/v1/conversations/{id}
Получить разговор с сообщениями.

**Response:**
```json
{
  "id": 1,
  "title": "Вопросы по тарифам",
  "is_archived": false,
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "Какие есть тарифы?",
      "use_rag": true,
      "created_at": "2026-02-18T14:00:00Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "Доступны следующие тарифные планы...",
      "use_rag": true,
      "created_at": "2026-02-18T14:00:05Z"
    }
  ]
}
```

### DELETE /api/v1/conversations/{id}
Удалить разговор со всеми сообщениями.

### PATCH /api/v1/conversations/{id}/title
Переименовать разговор.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| title | string | Новое название |

### POST /api/v1/conversations/{id}/chat
Отправить сообщение и получить ответ.

**Request Body:**
```json
{
  "content": "Как подключить предприятие?",
  "use_rag": true
}
```

**Response:**
```json
{
  "user_message": {
    "id": 10,
    "role": "user",
    "content": "Как подключить предприятие?",
    "use_rag": true
  },
  "assistant_message": {
    "id": 11,
    "role": "assistant",
    "content": "Для подключения предприятия необходимо...",
    "use_rag": true
  },
  "sources": [
    {
      "document_id": "doc_7",
      "content": "Процедура подключения...",
      "relevance": 0.88
    }
  ]
}
```

### DELETE /api/v1/conversations/{id}/messages
Очистить историю сообщений.

---

## Dashboard API

### GET /api/v1/dashboard/
Агрегированные данные дашборда.

**Response:**
```json
{
  "kpi": {
    "collections": {"current": 1.2, "target": 3.0},
    "participants": {"current": 2500, "target": 4500},
    "enterprises": {"inProgress": 15, "total": 30},
    "progress": 42
  },
  "timeline": [
    {
      "id": "task_1",
      "title": "Запуск пилота",
      "startQ": 1,
      "endQ": 2,
      "track": "external",
      "status": "in_progress"
    }
  ],
  "pipeline": {
    "A": [{"id": 1, "name": "Сбербанк", "score": 85, "category": "A", "status": "launched"}],
    "B": [],
    "V": [],
    "G": []
  },
  "funnel": {
    "contact": 10,
    "presentation": 8,
    "negotiation": 5,
    "contract": 3,
    "launched": 2
  },
  "risks": [
    {
      "id": "R1",
      "title": "Низкая конверсия",
      "probability": "medium",
      "impact": "high",
      "mitigation": "Улучшение презентационных материалов"
    }
  ],
  "milestones": [
    {
      "id": "M1",
      "month": "Янв",
      "title": "Запуск MVP",
      "status": "completed"
    }
  ]
}
```

### POST /api/v1/dashboard/tasks
Создать задачу таймлайна.

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| title | string | Название |
| track | string | internal / external / both |
| start_q | int | Начальный квартал (1-4) |
| end_q | int | Конечный квартал (1-4) |
| status | string | planned / in_progress / completed |

### PATCH /api/v1/dashboard/tasks/{id}
Обновить задачу.

### DELETE /api/v1/dashboard/tasks/{id}
Удалить задачу.

### POST /api/v1/dashboard/tasks/{id}/archive
Архивировать задачу.

### GET /api/v1/dashboard/tasks/archived
Список архивных задач.

### POST /api/v1/dashboard/seed
Заполнить демо-данными.

---

## Типы данных

### Enums

**EnterpriseStatus:**
```
PROSPECT | NEGOTIATION | PILOT | ACTIVE | INACTIVE
```

**EnterpriseCategory:**
```
A | B | V | G
```

**SalesStatus:**
```
CONTACT | PRESENTATION | NEGOTIATION | CONTRACT | LAUNCHED
```

**RoadmapStatus:**
```
PLANNED | IN_PROGRESS | COMPLETED | BLOCKED | CANCELLED
```

**Track:**
```
INTERNAL_PILOT | EXTERNAL_CLIENTS
```

**DocumentType:**
```
REGULATION | PRODUCT | PRESENTATION | CONTRACT_TEMPLATE | ANALYTICS | FAQ | OTHER
```

**DocumentStatus:**
```
ACTIVE | ARCHIVED | DELETED
```

**MilestoneStatus:**
```
PLANNED | IN_PROGRESS | COMPLETED | DELAYED
```

**RiskProbability:**
```
LOW | MEDIUM | HIGH
```

**RiskImpact:**
```
LOW | MEDIUM | HIGH | CRITICAL
```
