# NPF Development Project

## Project Context

Веб-приложение для планирования и отслеживания развития корпоративного блока Негосударственного пенсионного фонда (НПФ).

### Business Context
- **НПФ** в периметре крупного Банка-монополиста
- **Captive audience** — замкнутая экосистема B2B + B2C
- **Основной продукт:** ПДС (Программа долгосрочных сбережений)
- **Новое направление:** Корпоративные пенсионные программы (КПП)

### Три направления продаж (KPI)
1. **Внешние продажи** — построение корпоративного канала с нуля (ключевой KPI: Взносы)
2. **КПП в Банке** — масштабирование программы для сотрудников (ключевой KPI: Участники)
3. **Продажи в ЗК** — продажи зарплатным клиентам (ключевой KPI: Количество ДДС)

---

## Быстрый старт

### Docker (рекомендуется)

```bash
# Development с hot-reload (SQLite)
docker compose -f docker-compose.dev.yml up --build

# Production локально (PostgreSQL)
docker compose -f docker-compose.prod.yml up -d

# Server/Production (PostgreSQL + Claude API, без тяжёлых LLM)
docker compose -f docker-compose.server.yml --env-file .env.server up -d
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
ollama pull qwen2.5:7b      # Основная модель для чата
ollama pull qwen2.5:3b      # Быстрая модель для импорта Excel
ollama pull nomic-embed-text # Модель для эмбеддингов
```

### Доступ

| Среда | Frontend | Backend | Database |
|-------|----------|---------|----------|
| Docker Dev | http://localhost:3100 | http://localhost:8100 | SQLite |
| Docker Prod | http://localhost:3000 | http://localhost:8000 | PostgreSQL |
| Local | http://localhost:5173 | http://localhost:8000 | SQLite |

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
- **Docker** + docker-compose (3 конфигурации: dev, prod, server)
- **SQLite** (dev) / **PostgreSQL** (prod)
- **Nginx** (static serving)
- **Ollama** (embeddings: nomic-embed-text) + **Claude API** (LLM responses)

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
├── scripts/                # Скрипты управления
│   ├── deploy.sh           # Деплой на сервер с миграцией данных
│   ├── backup.sh           # Локальный бэкап
│   ├── backup-server.sh    # Бэкап с сервера
│   ├── restore-server.sh   # Восстановление на сервер
│   └── migrate_to_postgres.py  # Миграция SQLite → PostgreSQL
│
├── docker-compose.yml      # Production (legacy)
├── docker-compose.dev.yml  # Development (SQLite)
├── docker-compose.prod.yml # Production локально (PostgreSQL)
├── docker-compose.server.yml # Server (PostgreSQL + Claude API)
├── .env.example            # Environment template
├── .env.server.example     # Server environment template
└── CLAUDE.md               # This file
```

---

## Реализованный функционал

### Dashboard
- **10 KPI карточек** в 3 группах с прогресс-барами и % выполнения:
  - **Внешние продажи:** Взносы*, Предприятия, Договоры, Участники
  - **КПП в Банке:** Участники*, Проникновение, Взносы работников, Взносы Банка
  - **Продажи в ЗК:** Количество ДДС*, Сумма взносов
  - (*) — ключевые показатели с оранжевой подсветкой
- **Формулы автоматического расчёта KPI:**
  - Проникновение КПП: `целевые участники / численность Банка × 100%`
  - Взносы работников: `72 000 ₽ × целевые участники / 1 000 000` (млн ₽)
  - Взносы ЗК: `36 000 ₽ × целевое кол-во ДДС / 1 000 000` (млн ₽)
  - Взносы Банка: вводятся вручную через Настройки
- Timeline задач (Gantt-подобный) с CRUD
- Pipeline предприятий по категориям A/B/V/G
- Воронка продаж
- Матрица рисков
- Ключевые вехи
- **Настройки дашборда** — модальное окно с вкладками:
  - KPI и цели (целевые значения по 10 метрикам)
  - Численность Банка (для расчёта проникновения, с историей изменений)
  - Скоринг (правила категоризации предприятий)
  - Матрица рисков (пороги, цветовая схема)
  - Данные продаж (ручной ввод по 3 трекам)
  - Формулы (описание расчётов)
- **Оперативные данные продаж** — таблица SalesData с историей по трекам

### Enterprises (CRM)
- CRUD предприятий с полями: ИНН, Холдинг, отрасль, численность и др.
- Категоризация (A/B/V/G) и скоринг
- **Интеллектуальный импорт Excel/CSV** с LLM-маппингом колонок (qwen2.5:3b)
- Множественный выбор строк для групповых операций (удаление)
- Настраиваемая таблица (drag-drop колонок, сортировка)
- История контактов с клиентами
- Фильтрация по категории, статусу, этапу продаж
- **Этапы воронки продаж:** В планах → Первый контакт → Переговоры → Договор → Запущено

### Roadmap
- Задачи по кварталам
- Два трека (внутренний/внешний)
- Статусы и зависимости

### Documents (RAG)
- Загрузка файлов (PDF, DOCX, XLSX, CSV, TXT) до 30 МБ
- Ручная векторизация документов (до 10 МБ)
- Inline-редактирование названия и категории
- OCR через Claude Vision
- Векторный поиск в ChromaDB

### AI Chat
- Multi-turn разговоры
- RAG-режим (ответы из базы знаний)
- Streaming responses (SSE)
- Конфигурируемые LLM модели

---

## Data Models

| Модель | Таблица | Описание |
|--------|---------|----------|
| Enterprise | enterprises | Корпоративные клиенты (ИНН, холдинг, контакты, история) |
| Interaction | interactions | История контактов с клиентами |
| RoadmapItem | roadmap_items | Задачи дорожной карты |
| KPPContract | kpp_contracts | Договоры КПП |
| Document | documents | Метаданные документов |
| Conversation | conversations | AI-разговоры |
| ChatMessage | chat_messages | Сообщения |
| LLMConfig | llm_configs | Конфигурация моделей |
| Milestone | milestones | Ключевые вехи |
| Risk | risks | Риски проекта |
| TableConfig | table_configs | Настройки таблиц пользователя |
| SalesData | sales_data | Оперативные данные продаж с историей |
| DashboardConfig | dashboard_configs | Конфигурация дашборда (KPI, скоринг, риски) |

---

## API Endpoints

```
/api/v1/enterprises/              # CRUD предприятий
/api/v1/enterprises/import/preview  # Предпросмотр импорта с LLM-маппингом
/api/v1/enterprises/import        # Импорт с кастомным маппингом
/api/v1/enterprises/{id}/interactions  # История контактов

/api/v1/roadmap/        # CRUD дорожной карты
/api/v1/documents/      # Управление документами
/api/v1/rag/            # RAG запросы и чат
/api/v1/conversations/  # История разговоров
/api/v1/dashboard/      # Агрегированные данные
/api/v1/table-config/   # Настройки таблиц
/api/v1/sales-data/     # CRUD оперативных данных продаж
/api/v1/dashboard-config/ # Конфигурация дашборда (KPI, скоринг, риски)

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
| `backend/app/api/v1/endpoints/dashboard.py` | API дашборда с агрегацией KPI |
| `backend/app/api/v1/endpoints/dashboard_config.py` | API настроек дашборда |
| `backend/app/api/v1/endpoints/sales_data.py` | API данных продаж |
| `frontend/src/pages/Dashboard.tsx` | Главный дашборд с 10 KPI карточками |
| `frontend/src/components/DashboardSettingsModal.tsx` | Модал настроек дашборда |
| `frontend/src/services/api.ts` | HTTP клиент |
| `frontend/src/pages/Enterprises.tsx` | CRM предприятий |

---

## Enterprise Fields

Поля карточки предприятия для импорта Excel:

| Поле | Тип | Описание |
|------|-----|----------|
| name* | str | Наименование (обязательно) |
| inn | str | ИНН (10-12 цифр) |
| holding | str | Холдинг/группа компаний |
| industry | str | Отрасль |
| employee_count | int | Численность сотрудников |
| bank_penetration | float | Проникновение ЗП (%) |
| category | enum | Категория (A/B/V/G) |
| score | int | Скоринг-балл |
| locations | str | Площадки/филиалы |
| contact_person | str | Контактное лицо |
| contact_email | str | Email |
| contact_phone | str | Телефон |
| manager | str | Ответственный менеджер |
| notes | str | Заметки |

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
- [x] Все модели данных (13 таблиц)
- [x] RAG система (ChromaDB + Ollama)
- [x] Dashboard с 10 KPI карточками в 3 группах
- [x] CRUD для всех сущностей
- [x] AI-чат с историей
- [x] Docker конфигурация (dev, prod, server)
- [x] Интеллектуальный импорт Excel с LLM-маппингом
- [x] Настраиваемые таблицы (drag-drop, сортировка)
- [x] История контактов с клиентами
- [x] Групповые операции (множественный выбор)
- [x] Настройки дашборда (KPI по 3 трекам, скоринг, риски, формулы)
- [x] Оперативные данные продаж с историей по трекам
- [x] Численность Банка для расчёта проникновения (с историей)
- [x] Прогресс-бары с % выполнения в KPI карточках
- [x] Автоматический расчёт целевых KPI по формулам
- [x] **PostgreSQL для production** (docker-compose.prod.yml)
- [x] **Скрипты деплоя** (deploy.sh, backup-server.sh, restore-server.sh)
- [x] **Миграция SQLite → PostgreSQL** (migrate_to_postgres.py)
- [x] **Server-конфигурация** (Ollama только для эмбеддингов + Claude API)
- [x] Даты актуальности данных на KPI карточках
- [x] Веса KPI (40%-30%-30%)
- [x] Этап "Переговоры" в воронке продаж

### В планах
- [ ] **Деплой на VPS-сервер** (ожидает аренды сервера)
- [ ] Аутентификация (JWT + RBAC)
- [ ] Email уведомления
- [ ] Экспорт отчётов (PDF, Excel)
- [ ] Интеграции (1C, CRM)

---

## Хранение данных (Production)

| Данные | Docker Volume | Описание |
|--------|---------------|----------|
| PostgreSQL | `npf_postgres_data` | Основная БД (предприятия, KPI, настройки) |
| ChromaDB | `npf_chroma` | Векторная база RAG |
| Документы | `npf_documents` | PDF/DOCX файлы для RAG |
| Uploads | `npf_uploads` | Загруженные файлы |
| Ollama | `npf_ollama_embed` | Модель nomic-embed-text (~275 MB) |

---

## Последняя сессия (21 февраля 2026)

### Выполнено
1. Добавлены даты актуальности данных на KPI карточки
2. Добавлены веса KPI (40%-30%-30%) на ключевые карточки
3. Добавлен этап "Переговоры" в воронку продаж
4. Настроен PostgreSQL для production (docker-compose.prod.yml)
5. Выполнена миграция 35 предприятий из SQLite в PostgreSQL
6. Перенесены документы RAG в Docker volume
7. Создана server-конфигурация (docker-compose.server.yml):
   - Ollama только для эмбеддингов (nomic-embed-text)
   - Claude API для генерации ответов
8. Созданы скрипты деплоя: deploy.sh, backup-server.sh, restore-server.sh

### Следующие шаги
1. Арендовать VPS-сервер (рекомендации: Timeweb, Selectel, Hetzner)
2. Выполнить деплой: `./scripts/deploy.sh user@server`
3. Настроить .env.server с ANTHROPIC_API_KEY

### Текущее состояние
- Production работает локально: http://localhost:3000
- PostgreSQL: 35 предприятий, 9 задач roadmap, 7 вех, 7 рисков
- ChromaDB: 3 документа проиндексированы

---

*Последнее обновление: 21 февраля 2026, 15:03*
