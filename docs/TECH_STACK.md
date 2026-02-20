# Технологический стек

## Обзор

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  React 18 + TypeScript + Vite + React Router + Axios        │
└──────────────────────────────────────────────────────────────┘
                              │
                         REST API / SSE
                              │
┌──────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  Python 3.11 + FastAPI + SQLAlchemy + Pydantic              │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────┴───────┐    ┌───────┴───────┐    ┌───────┴───────┐
│    SQLite     │    │   ChromaDB    │    │    Ollama     │
│  (Database)   │    │   (Vectors)   │    │    (LLM)      │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Frontend

### Основные технологии

| Технология | Версия | Назначение |
|------------|--------|------------|
| **React** | 18.2.0 | UI библиотека |
| **TypeScript** | 5.3.3 | Типизация |
| **Vite** | 5.0.8 | Сборщик и dev-сервер |
| **React Router** | 6.30.3 | Маршрутизация SPA |
| **Axios** | 1.6.2 | HTTP-клиент |
| **Zustand** | 4.4.7 | State management |
| **Recharts** | 2.10.3 | Графики и диаграммы |
| **date-fns** | 3.0.6 | Работа с датами |

### Структура зависимостей

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.30.3",
    "axios": "^1.6.2",
    "zustand": "^4.4.7",
    "recharts": "^2.10.3",
    "date-fns": "^3.0.6"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "@types/react": "^18.2.43",
    "@vitejs/plugin-react": "^4.2.1"
  }
}
```

### Особенности конфигурации

**vite.config.ts:**
- Dev-сервер на порту 3000
- Proxy на backend (/api -> localhost:8000)
- Hot Module Replacement

## Backend

### Основные технологии

| Технология | Версия | Назначение |
|------------|--------|------------|
| **Python** | 3.11 | Язык программирования |
| **FastAPI** | 0.109.0 | Web-фреймворк |
| **Uvicorn** | 0.27.0 | ASGI-сервер |
| **SQLAlchemy** | 2.0.25 | ORM (async) |
| **Pydantic** | 2.x | Валидация данных |
| **aiosqlite** | 0.19.0 | Async SQLite драйвер |
| **ChromaDB** | 0.4.22 | Векторная БД |
| **Anthropic SDK** | 0.18.0+ | Claude API клиент |

### Полный список зависимостей

```
# Web Framework
fastapi==0.109.0
uvicorn[standard]==0.27.0
sse-starlette==1.8.2
python-multipart==0.0.6

# Database
sqlalchemy==2.0.25
aiosqlite==0.19.0
alembic==1.13.1

# Vector Store
chromadb==0.4.22

# LLM Integration
anthropic>=0.18.0
httpx>=0.25.0

# File Processing
pandas==2.1.4
openpyxl==3.1.2
python-docx==1.1.0
pypdf==3.17.4
PyMuPDF>=1.23.0

# Authentication (подготовлено)
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Utilities
python-dotenv==1.0.0
aiofiles==23.2.1
```

### Async-first архитектура

```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

engine = create_async_engine(
    "sqlite+aiosqlite:///./npf.db",
    echo=False
)

async_session = async_sessionmaker(engine, class_=AsyncSession)
```

## База данных

### SQLite (Development)

- **Драйвер**: aiosqlite (async)
- **ORM**: SQLAlchemy 2.0 (async)
- **Файл**: `backend/npf.db`

### Миграции

- **Инструмент**: Alembic 1.13.1
- **Статус**: Подготовлен, не активирован

### Модели данных

| Модель | Таблица | Описание |
|--------|---------|----------|
| Enterprise | enterprises | Корпоративные клиенты |
| RoadmapItem | roadmap_items | Задачи дорожной карты |
| KPPContract | kpp_contracts | Договоры КПП |
| Document | documents | Метаданные документов |
| Conversation | conversations | Разговоры с AI |
| ChatMessage | chat_messages | Сообщения в разговорах |
| LLMConfig | llm_configs | Конфигурация LLM |
| Milestone | milestones | Ключевые вехи |
| Risk | risks | Риски проекта |

## Векторное хранилище

### ChromaDB

| Параметр | Значение |
|----------|----------|
| Версия | 0.4.22 |
| Хранение | Persistent (файловая система) |
| Путь | `backend/data/chromadb/` |
| Метрика | Cosine Similarity |
| Embedding | Ollama (nomic-embed-text) |

### Конфигурация

```python
# document_service.py
self.client = chromadb.PersistentClient(
    path=settings.CHROMA_PERSIST_DIRECTORY
)
self.collection = self.client.get_or_create_collection(
    name="npf_documents",
    metadata={"hnsw:space": "cosine"}
)
```

## LLM Integration

### Ollama (Primary)

| Функция | Модель | Описание |
|---------|--------|----------|
| Chat | qwen2.5:7b | Генерация ответов |
| Embeddings | nomic-embed-text | Векторизация текста |

**Преимущества:**
- Локальный запуск (приватность данных)
- Без API-ключей
- Низкая латентность

### Anthropic Claude (Fallback)

| Модель | Версия | Применение |
|--------|--------|------------|
| Claude Sonnet | claude-sonnet-4-20250514 | Сложные задачи, Vision |

**Применение:**
- OCR документов (Vision)
- Fallback при недоступности Ollama
- Генерация названий документов

## DevOps

### Docker

| Образ | Базовый образ | Назначение |
|-------|---------------|------------|
| frontend | node:20-alpine → nginx:alpine | SPA + статика |
| backend | python:3.11-slim | FastAPI сервер |
| ollama | ollama/ollama | LLM inference |

### Docker Compose

**Production (docker-compose.yml):**
```yaml
services:
  frontend:
    ports: ["3100:80"]
  backend:
    ports: ["8100:8000"]
  ollama:
    ports: ["11435:11434"]
```

**Development (docker-compose.dev.yml):**
```yaml
services:
  frontend:
    volumes: ["./frontend/src:/app/src"]  # hot-reload
  backend:
    volumes: ["./backend/app:/app/app"]   # hot-reload
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
```

## Сетевая конфигурация

### Порты

| Сервис | Development (Local) | Development (Docker) | Production |
|--------|---------------------|----------------------|------------|
| Frontend | 5173 | 3100 | 3100 |
| Backend | 8000 | 8100 | 8100 |
| Ollama | 11434 | 11435 (или host) | 11435 |

### CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3004",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Переменные окружения

```bash
# Application
APP_NAME=NPF-Development
APP_ENV=development
DEBUG=true

# Server
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# Frontend
VITE_API_URL=http://localhost:8000

# Database
DATABASE_URL=sqlite+aiosqlite:///./npf.db

# Vector Store
CHROMA_PERSIST_DIRECTORY=./chroma_db

# LLM
OLLAMA_BASE_URL=http://localhost:11434
ANTHROPIC_API_KEY=your-api-key-here

# Security
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Uploads
MAX_UPLOAD_SIZE_MB=50
ALLOWED_EXTENSIONS=.xlsx,.xls,.csv,.pdf,.docx,.txt
```

## Сравнение с альтернативами

### Почему FastAPI?

| Критерий | FastAPI | Django | Flask |
|----------|---------|--------|-------|
| Async native | + | +/- | - |
| Автодокументация | + | - | - |
| Валидация | Pydantic | Forms | Manual |
| Производительность | Высокая | Средняя | Средняя |
| Скорость разработки | Высокая | Высокая | Средняя |

### Почему React + Vite?

| Критерий | Vite | Create React App | Next.js |
|----------|------|------------------|---------|
| Скорость сборки | Мгновенная | Медленная | Средняя |
| HMR | + | +/- | + |
| Конфигурация | Минимальная | Скрыта | Средняя |
| SSR | - | - | + |

### Почему ChromaDB?

| Критерий | ChromaDB | Pinecone | Milvus |
|----------|----------|----------|--------|
| Self-hosted | + | - | + |
| Простота | Высокая | Высокая | Средняя |
| Масштабирование | Среднее | Высокое | Высокое |
| Стоимость | Бесплатно | Платно | Бесплатно |
