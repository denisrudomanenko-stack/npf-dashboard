# Руководство разработчика

## Начало работы

### Требования

| Компонент | Версия | Примечание |
|-----------|--------|------------|
| Docker Desktop | Latest | Рекомендуется для разработки |
| Node.js | 20+ | Для локального frontend |
| Python | 3.11+ | Для локального backend |
| Ollama | Latest | Для локального LLM |

### Клонирование репозитория

```bash
git clone <repo-url>
cd NPF-project
```

### Настройка окружения

```bash
# Скопировать пример .env
cp .env.example .env

# Отредактировать переменные при необходимости
vim .env
```

---

## Запуск проекта

### Вариант 1: Docker (рекомендуется)

```bash
# Development режим с hot-reload
docker compose -f docker-compose.dev.yml up --build

# Production режим
docker compose up --build
```

**Доступ:**
- Frontend: http://localhost:3100
- Backend API: http://localhost:8100
- API Docs: http://localhost:8100/docs

### Вариант 2: Локальный запуск

#### Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
.\venv\Scripts\activate   # Windows

# Установить зависимости
pip install -r requirements.txt

# Запустить сервер
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Установить зависимости
npm install

# Запустить dev-сервер
npm run dev
```

#### Ollama

```bash
# Установить Ollama (macOS)
brew install ollama

# Запустить сервер
ollama serve

# В другом терминале - скачать модели
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

---

## Структура проекта

```
NPF-project/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # API роутеры
│   │   ├── models/             # SQLAlchemy модели
│   │   ├── schemas/            # Pydantic схемы
│   │   ├── services/           # Бизнес-логика
│   │   ├── main.py             # Точка входа
│   │   ├── config.py           # Настройки
│   │   └── database.py         # Подключение к БД
│   ├── data/
│   │   ├── chromadb/           # Векторная БД
│   │   └── documents/          # Загруженные файлы
│   ├── requirements.txt
│   └── Dockerfile.dev
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # Страницы
│   │   ├── components/         # Компоненты
│   │   ├── services/           # API клиент
│   │   ├── stores/             # State management
│   │   └── types/              # TypeScript типы
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                       # Документация
├── docker-compose.yml          # Production
├── docker-compose.dev.yml      # Development
└── .env.example
```

---

## Разработка Backend

### Создание нового эндпоинта

1. **Создать роутер** в `backend/app/api/v1/endpoints/`

```python
# backend/app/api/v1/endpoints/new_feature.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

router = APIRouter()

@router.get("/")
async def list_items(db: AsyncSession = Depends(get_db)):
    # Логика
    return {"items": []}

@router.post("/")
async def create_item(data: ItemCreate, db: AsyncSession = Depends(get_db)):
    # Логика
    return {"id": 1}
```

2. **Зарегистрировать роутер** в `main.py`

```python
from app.api.v1.endpoints import new_feature

app.include_router(
    new_feature.router,
    prefix="/api/v1/new-feature",
    tags=["New Feature"]
)
```

### Создание новой модели

1. **Определить модель** в `backend/app/models/`

```python
# backend/app/models/new_model.py
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

class NewModel(Base):
    __tablename__ = "new_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

2. **Экспортировать** в `backend/app/models/__init__.py`

```python
from app.models.new_model import NewModel

__all__ = [
    # ... существующие модели
    "NewModel"
]
```

3. **Импортировать в main.py** для регистрации

```python
from app.models import NewModel  # Добавить в импорты
```

### Создание Pydantic схемы

```python
# backend/app/schemas/new_model.py
from pydantic import BaseModel
from datetime import datetime

class NewModelCreate(BaseModel):
    name: str

class NewModelResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True
```

### Async паттерны

```python
# Получение записей
async def get_items(db: AsyncSession):
    result = await db.execute(select(Model))
    return result.scalars().all()

# Создание записи
async def create_item(db: AsyncSession, data: CreateSchema):
    item = Model(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

# Обновление записи
async def update_item(db: AsyncSession, item_id: int, data: UpdateSchema):
    result = await db.execute(
        select(Model).where(Model.id == item_id)
    )
    item = result.scalar_one_or_none()
    if item:
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        await db.commit()
        await db.refresh(item)
    return item
```

---

## Разработка Frontend

### Создание новой страницы

1. **Создать компонент страницы**

```tsx
// frontend/src/pages/NewPage.tsx
import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface Item {
  id: number
  name: string
}

function NewPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      const response = await api.get('/new-feature/')
      setItems(response.data)
    } catch (error) {
      console.error('Failed to load items:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Загрузка...</div>

  return (
    <div className="new-page">
      <h1>New Feature</h1>
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  )
}

export default NewPage
```

2. **Добавить маршрут** в `App.tsx`

```tsx
import NewPage from './pages/NewPage'

// В Routes
<Route path="/new-feature" element={<NewPage />} />
```

3. **Добавить в навигацию** в `Layout.tsx`

```tsx
<NavLink to="/new-feature">New Feature</NavLink>
```

### TypeScript типы

```typescript
// frontend/src/types/index.ts

export interface NewItem {
  id: number
  name: string
  createdAt: string
}

export interface NewItemCreate {
  name: string
}
```

### API-вызовы

```typescript
// Использование api сервиса
import { api } from '../services/api'

// GET
const response = await api.get('/endpoint/')
const data = response.data

// POST
const response = await api.post('/endpoint/', { name: 'test' })

// PUT
await api.put(`/endpoint/${id}`, updateData)

// DELETE
await api.delete(`/endpoint/${id}`)

// PATCH
await api.patch(`/endpoint/${id}`, { field: 'value' })

// File upload
const formData = new FormData()
formData.append('file', file)
await api.post('/documents/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
```

---

## Работа с RAG

### Индексация документа

```python
from app.services.document_service import DocumentService

doc_service = DocumentService()

# Добавить файл
await doc_service.add_file(
    file_path="/path/to/file.pdf",
    filename="document.pdf",
    document_type="regulation",
    metadata={"author": "Admin"}
)

# Добавить текст
await doc_service.add_document(
    doc_id="custom_id",
    content="Текст документа...",
    metadata={"source": "manual", "type": "faq"}
)
```

### Поиск

```python
# Векторный поиск
results = await doc_service.search(
    query="условия подключения",
    top_k=5,
    document_type="regulation"  # опционально
)

# RAG-запрос с генерацией
from app.services.rag_service import RAGService

rag = RAGService()
response = await rag.query(
    query="Какие преимущества программы?",
    top_k=5
)
print(response["answer"])
print(response["sources"])
```

### Настройка чанкинга

```python
# В document_service.py
CHUNK_CONFIGS = {
    "regulation": {"size": 800, "overlap": 80},
    "product": {"size": 1000, "overlap": 100},
    "presentation": {"size": 400, "overlap": 40},
    # Добавить новый тип
    "custom_type": {"size": 600, "overlap": 60}
}
```

---

## Тестирование

### Backend тесты

```bash
cd backend

# Установить pytest
pip install pytest pytest-asyncio httpx

# Запустить тесты
pytest tests/ -v
```

```python
# tests/test_api.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
```

### Frontend тесты

```bash
cd frontend

# Установить testing library
npm install -D @testing-library/react @testing-library/jest-dom vitest

# Запустить тесты
npm test
```

---

## Отладка

### Backend логирование

```python
import logging

logger = logging.getLogger(__name__)

@router.get("/")
async def endpoint():
    logger.info("Processing request")
    logger.debug("Debug info: %s", data)
    logger.error("Error occurred", exc_info=True)
```

### API документация

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Database инспекция

```bash
# Подключиться к SQLite
sqlite3 backend/npf.db

# Просмотр таблиц
.tables

# Структура таблицы
.schema enterprises

# Запрос
SELECT * FROM enterprises LIMIT 5;
```

### ChromaDB инспекция

```python
import chromadb

client = chromadb.PersistentClient(path="./backend/data/chromadb")
collection = client.get_collection("npf_documents")

# Количество документов
print(collection.count())

# Peek данные
print(collection.peek())
```

---

## Git Workflow

### Коммиты

```bash
# Формат коммита
<type>(<scope>): <description>

# Примеры
feat(dashboard): add risk matrix visualization
fix(api): correct enterprise filtering
docs(readme): update installation guide
refactor(services): extract RAG logic
```

### Типы коммитов

| Тип | Описание |
|-----|----------|
| feat | Новая функциональность |
| fix | Исправление бага |
| docs | Документация |
| style | Форматирование |
| refactor | Рефакторинг |
| test | Тесты |
| chore | Обслуживание |

---

## Частые проблемы

### Порт занят

```bash
# Найти процесс
lsof -i :8000

# Завершить
kill -9 <PID>
```

### Сброс базы данных

```bash
# Удалить SQLite
rm backend/npf.db

# Удалить ChromaDB
rm -rf backend/data/chromadb

# Перезапустить backend (БД создастся автоматически)
```

### Ollama не отвечает

```bash
# Проверить статус
curl http://localhost:11434/api/tags

# Перезапустить
ollama serve

# Проверить модели
ollama list
```

### Docker volumes

```bash
# Очистить volumes (ОСТОРОЖНО: удалит данные)
docker compose -f docker-compose.dev.yml down -v

# Пересобрать без кэша
docker compose -f docker-compose.dev.yml build --no-cache
```
