# NPF Development Project

## Project Context

Веб-приложение для планирования и отслеживания развития корпоративного блока Негосударственного пенсионного фонда (НПФ).

### Business Context
- **НПФ** в периметре крупного Банка-монополиста
- **Captive audience** — замкнутая экосистема B2B + B2C
- **Основной продукт:** ПДС (Программа долгосрочных сбережений)
- **Новое направление:** Корпоративные пенсионные программы (КПП)

### Два трека развития
1. **Трек 1: Сотрудники Банка** — масштабирование (9% → 17% проникновение)
2. **Трек 2: Внешние клиенты** — построение с нуля (30-50 предприятий, 3 млрд руб)

---

## Быстрый старт

### Docker (рекомендуется)

```bash
# Development с hot-reload
docker compose -f docker-compose.dev.yml up --build

# Production
docker compose up --build
```

### Локально

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Ollama (LLM)
ollama serve
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

### Доступ

| Среда | Frontend | Backend | Ollama |
|-------|----------|---------|--------|
| Docker Dev | http://localhost:3100 | http://localhost:8100 | host:11434 |
| Local | http://localhost:5173 | http://localhost:8000 | http://localhost:11434 |

---

## Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **React Router** 6.x (SPA routing)
- **Axios** (HTTP client)
- **Zustand** (state management)
- **Recharts** (визуализации)

### Backend
- **Python 3.11** + FastAPI
- **SQLAlchemy 2.0** (async ORM)
- **ChromaDB** (vector store)
- **Ollama** (local LLM) / **Anthropic** (Claude API)
- **Pydantic** (validation)

### Infrastructure
- **Docker** + docker-compose
- **SQLite** (dev) → **PostgreSQL** (prod)
- **Nginx** (static serving)

---

## Project Structure

```
NPF-project/
├── frontend/               # React SPA
│   ├── src/
│   │   ├── pages/          # Dashboard, Enterprises, Roadmap, Chat, Documents
│   │   ├── components/     # Layout, UI components
│   │   ├── services/       # api.ts (Axios client)
│   │   └── types/          # TypeScript interfaces
│   └── package.json
│
├── backend/                # FastAPI
│   ├── app/
│   │   ├── api/v1/endpoints/  # REST API routers
│   │   ├── models/         # SQLAlchemy ORM (8 моделей)
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # RAG, Document, Ollama services
│   │   └── main.py         # FastAPI app
│   ├── data/
│   │   ├── chromadb/       # Vector DB
│   │   └── documents/      # Uploaded files
│   └── requirements.txt
│
├── docs/                   # Документация
│   ├── README.md           # Обзор
│   ├── ARCHITECTURE.md     # Архитектура
│   ├── TECH_STACK.md       # Технологии
│   ├── FEATURES.md         # Функционал
│   ├── API.md              # API reference
│   ├── DEVELOPMENT.md      # Руководство разработчика
│   └── ROADMAP.md          # План развития
│
├── docker-compose.yml      # Production
├── docker-compose.dev.yml  # Development
├── .env.example            # Environment template
└── CLAUDE.md               # This file
```

---

## Реализованный функционал

### Dashboard
- KPI карточки (сборы, участники, прогресс)
- Timeline задач (Gantt-подобный) с CRUD
- Pipeline предприятий по категориям A/B/V/G
- Воронка продаж
- Матрица рисков
- Ключевые вехи

### Enterprises (CRM)
- CRUD предприятий
- Категоризация и скоринг
- Импорт из Excel/CSV
- Фильтрация по статусу

### Roadmap
- Задачи по кварталам
- Два трека (внутренний/внешний)
- Статусы и зависимости

### Documents (RAG)
- Загрузка файлов (PDF, DOCX, XLSX, CSV, TXT)
- Автоматическая индексация в ChromaDB
- OCR через Claude Vision
- Векторный поиск

### AI Chat
- Multi-turn разговоры
- RAG-режим (ответы из базы знаний)
- Streaming responses (SSE)
- Конфигурируемые LLM модели

---

## Data Models

| Модель | Таблица | Описание |
|--------|---------|----------|
| Enterprise | enterprises | Корпоративные клиенты |
| RoadmapItem | roadmap_items | Задачи дорожной карты |
| KPPContract | kpp_contracts | Договоры КПП |
| Document | documents | Метаданные документов |
| Conversation | conversations | AI-разговоры |
| ChatMessage | chat_messages | Сообщения |
| LLMConfig | llm_configs | Конфигурация моделей |
| Milestone | milestones | Ключевые вехи |
| Risk | risks | Риски проекта |

---

## API Endpoints

```
/api/v1/enterprises/    # CRUD предприятий
/api/v1/roadmap/        # CRUD дорожной карты
/api/v1/documents/      # Управление документами
/api/v1/rag/            # RAG запросы и чат
/api/v1/conversations/  # История разговоров
/api/v1/dashboard/      # Агрегированные данные

/health                 # Health check
/docs                   # Swagger UI
```

---

## Key Files

| Файл | Назначение |
|------|------------|
| `backend/app/main.py` | FastAPI entrypoint |
| `backend/app/services/rag_service.py` | RAG + LLM логика |
| `backend/app/services/document_service.py` | Индексация документов |
| `frontend/src/pages/Dashboard.tsx` | Главный дашборд |
| `frontend/src/services/api.ts` | HTTP клиент |

---

## Environment Variables

```bash
# Database
DATABASE_URL=sqlite+aiosqlite:///./npf.db

# Vector Store
CHROMA_PERSIST_DIRECTORY=./chroma_db

# LLM
OLLAMA_BASE_URL=http://localhost:11434
ANTHROPIC_API_KEY=your-key

# Server
BACKEND_PORT=8000
```

---

## Conventions

- **Commits:** conventional commits (feat:, fix:, docs:)
- **API:** RESTful, prefix /api/v1/
- **Async:** все DB операции через async/await
- **Документация:** см. папку /docs

---

## Статус проекта

### Готово
- [x] Backend структура (FastAPI + SQLAlchemy)
- [x] Frontend структура (React + Vite)
- [x] Все модели данных
- [x] RAG система (ChromaDB + Ollama)
- [x] Dashboard с визуализациями
- [x] CRUD для всех сущностей
- [x] AI-чат с историей
- [x] Docker конфигурация

### В планах
- [ ] Аутентификация (JWT + RBAC)
- [ ] PostgreSQL для production
- [ ] Email уведомления
- [ ] Экспорт отчётов (PDF, Excel)
- [ ] Интеграции (1C, CRM)

---

*Последнее обновление: февраль 2026*
