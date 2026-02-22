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
- **Timeweb AI** (DeepSeek Reasoner) / **Ollama** / **Anthropic** (Claude API)
- **Pydantic** (validation)

### Infrastructure
- **Docker** + docker-compose (3 конфигурации: dev, prod, server)
- **SQLite** (dev) / **PostgreSQL** (prod)
- **Nginx** (static serving, client_max_body_size: 50MB)
- **LLM провайдеры:** Timeweb AI (облако) + Ollama (локально) + Claude API

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
│   │   ├── services/       # RAG, Document, Ollama, Timeweb AI services
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
├── docker-compose.prod.yml # Production локально (PostgreSQL + Ollama)
├── docker-compose.server.yml # Server full (PostgreSQL + Ollama + Claude API)
├── docker-compose.simple.yml # Server simple (PostgreSQL only, без AI)
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
- **Лимит хранилища:** 3 ГБ для активных + 3 ГБ для архива
- **Шкала заполненности** с цветовой индикацией (зелёный/оранжевый/красный)
- **Архив документов** с возможностью восстановления
- Карточка документа с редактированием атрибутов
- Ручная векторизация документов (только Admin)
- OCR через Claude Vision
- Векторный поиск в ChromaDB
- **Модальные окна** вместо alert() для ошибок

### AI Chat
- Multi-turn разговоры
- RAG-режим (ответы из базы знаний)
- Streaming responses (SSE)
- **3 LLM провайдера:** Timeweb AI, Ollama, Anthropic
- **Настройки LLM** в боковой панели:
  - Чат: выбор провайдера и модели
  - OCR: Claude Vision
  - Embeddings: Ollama nomic-embed-text
- **Индикаторы доступности** провайдеров (TW/OL/CL)

---

## Data Models

| Модель | Таблица | Описание |
|--------|---------|----------|
| User | users | Пользователи системы (логин, роль, пароль) |
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
# Auth (public)
POST /api/v1/auth/login     # Получить JWT-токен
GET  /api/v1/auth/me        # Текущий пользователь (требует токен)

# Users (admin only)
GET    /api/v1/users/       # Список пользователей
POST   /api/v1/users/       # Создать пользователя
GET    /api/v1/users/{id}   # Получить пользователя
PUT    /api/v1/users/{id}   # Обновить пользователя
DELETE /api/v1/users/{id}   # Удалить пользователя

# Enterprises (manager+)
/api/v1/enterprises/              # CRUD предприятий
/api/v1/enterprises/import/preview  # Предпросмотр импорта с LLM-маппингом
/api/v1/enterprises/import        # Импорт с кастомным маппингом
/api/v1/enterprises/{id}/interactions  # История контактов

# Other (viewer+ for read, manager+ for write)
/api/v1/roadmap/        # CRUD дорожной карты
/api/v1/documents/      # Управление документами
/api/v1/rag/            # RAG запросы и чат
/api/v1/conversations/  # История разговоров
/api/v1/dashboard/      # Агрегированные данные
/api/v1/table-config/   # Настройки таблиц
/api/v1/sales-data/     # CRUD оперативных данных продаж
/api/v1/dashboard-config/ # Конфигурация дашборда (admin only для изменений)

/health                 # Health check
/docs                   # Swagger UI
```

---

## Key Files

| Файл | Назначение |
|------|------------|
| `backend/app/main.py` | FastAPI entrypoint |
| `backend/app/services/rag_service.py` | RAG + LLM логика (3 провайдера) |
| `backend/app/services/timeweb_ai_service.py` | Timeweb Cloud AI клиент |
| `backend/app/services/ollama_service.py` | Ollama клиент (эмбеддинги + чат) |
| `backend/app/services/document_service.py` | Индексация документов |
| `backend/app/api/v1/endpoints/documents.py` | API документов (хранилище, архив) |
| `backend/app/api/v1/endpoints/rag.py` | API чата, LLM-конфигурации |
| `frontend/src/pages/Chat.tsx` | AI-ассистент с настройками LLM |
| `frontend/src/pages/Documents.tsx` | Библиотека документов |
| `frontend/src/components/StorageBar.tsx` | Шкала заполненности хранилища |
| `frontend/src/components/ErrorModal.tsx` | Модальное окно ошибок |
| `frontend/src/pages/Dashboard.tsx` | Главный дашборд с 10 KPI карточками |
| `frontend/src/services/api.ts` | HTTP клиент |

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

# LLM Providers
OLLAMA_BASE_URL=http://localhost:11434
ANTHROPIC_API_KEY=your-anthropic-key

# Timeweb AI (Cloud)
TIMEWEB_AI_TOKEN=your-timeweb-jwt-token
TIMEWEB_AGENT_ID=your-agent-uuid
CHAT_PROVIDER=timeweb  # timeweb, ollama, or anthropic

# Server
BACKEND_PORT=8000
SECRET_KEY=your-jwt-secret
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
- [x] **Деплой на VPS Timeweb** (217.198.9.249) — остановлен до интеграции авторизации
- [x] **Упрощённая конфигурация** (docker-compose.simple.yml) — без AI/LLM
- [x] **JWT-авторизация** с ролями (admin, manager, viewer)
- [x] **Защита всех API-эндпоинтов** (требуется токен)
- [x] **Страница входа** и управление пользователями
- [x] **Скрипт создания администратора** (scripts/create_admin.py)
- [x] **Владение сущностями (created_by_id)**:
  - Manager может редактировать/удалять только **свои** записи
  - Admin может редактировать/удалять **все** записи
  - Старые записи (created_by_id = NULL) — только Admin
- [x] **Векторизация документов** — только для Admin
- [x] **Toast-уведомления** при ошибках прав доступа (403)
- [x] **Tooltips** на кнопках с ограниченным доступом
- [x] **Timeweb AI интеграция** (DeepSeek Reasoner через OpenAI-совместимый API)
- [x] **Лимиты хранилища** (3 ГБ активные + 3 ГБ архив)
- [x] **Архив документов** с восстановлением
- [x] **Модальные окна ошибок** вместо alert()
- [x] **Карточка документа** с редактированием
- [x] **Настройки LLM** в AI-ассистенте (выбор провайдера/модели)
- [x] **Индикаторы провайдеров** (TW/OL/CL)

### В планах

#### Приоритет 1: RAG на сервере
- [ ] ChromaDB для векторного поиска
- [ ] Ollama для эмбеддингов (nomic-embed-text)
- [ ] Интеллектуальный импорт Excel с LLM

#### Приоритет 2: HTTPS
- [ ] Домен 24pensi.ru (в процессе регистрации)
- [ ] Let's Encrypt SSL-сертификат
- [ ] Certbot установлен, готов к настройке

#### Приоритет 3: Дополнительные функции
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

## Сервер (Production)

| Параметр | Значение |
|----------|----------|
| **Провайдер** | Timeweb Cloud |
| **IP-адрес** | 217.198.9.249 |
| **SSH** | `ssh -i ~/.ssh/npf_server root@217.198.9.249` |
| **Статус** | ✅ Работает (JWT + RBAC + Ownership) |
| **Frontend** | http://217.198.9.249 |
| **Backend** | http://217.198.9.249:8000 |

### Запуск сервера
```bash
ssh -i ~/.ssh/npf_server root@217.198.9.249
cd /opt/npf-project
docker compose -f docker-compose.simple.yml --env-file .env.server up -d
```

### Остановка сервера
```bash
ssh -i ~/.ssh/npf_server root@217.198.9.249
cd /opt/npf-project
docker compose -f docker-compose.simple.yml down
```

---

## Последняя сессия (22 февраля 2026)

### Выполнено

#### 1. Timeweb AI интеграция
- Создан `timeweb_ai_service.py` — OpenAI-совместимый клиент
- Модель: **DeepSeek Reasoner** (deepseek-reasoner)
- Обновлён `rag_service.py` — поддержка 3 провайдеров (timeweb → anthropic → ollama)
- Добавлены переменные: `TIMEWEB_AI_TOKEN`, `TIMEWEB_AGENT_ID`, `CHAT_PROVIDER`

#### 2. Улучшения раздела "Документы"
- **Лимит хранилища:** 3 ГБ для активных документов
- **Архив:** отдельный лимит 3 ГБ, модальное окно, восстановление/удаление
- **Шкала заполненности:** цветовая индикация (<80% зелёный, 80-95% оранжевый, >95% красный)
- **Карточка документа:** просмотр и редактирование атрибутов
- **Модальные окна:** ErrorModal вместо alert()
- **Порядок кнопок:** Карточка → Просмотр → Скачать → Архив → Удалить
- **Blob-загрузка:** авторизованный просмотр/скачивание файлов

#### 3. Настройки LLM в AI-ассистенте
- 3 карточки моделей: Чат, OCR, Embed
- Показ провайдера в каждой карточке
- Индикаторы доступности: TW (Timeweb), OL (Ollama), CL (Claude)
- Выбор провайдера и модели в модальном окне

#### 4. Подготовка HTTPS
- Домен `24pensi.ru` (заявка отправлена)
- Certbot установлен на сервере
- Nginx настроен: `client_max_body_size 50M`

### Новые файлы
| Файл | Описание |
|------|----------|
| `backend/app/services/timeweb_ai_service.py` | Клиент Timeweb Cloud AI |
| `frontend/src/components/StorageBar.tsx` | Шкала заполненности хранилища |
| `frontend/src/components/ErrorModal.tsx` | Модальное окно ошибок |

### Изменённые файлы
| Backend | Frontend |
|---------|----------|
| `app/config.py` | `pages/Chat.tsx` |
| `app/services/rag_service.py` | `pages/Documents.tsx` |
| `app/api/v1/endpoints/rag.py` | `pages/Users.tsx` |
| `app/api/v1/endpoints/documents.py` | `types/index.ts` |
| `app/models/document.py` | |

### LLM провайдеры

| Провайдер | Модель | Функция | Доступность |
|-----------|--------|---------|-------------|
| **Timeweb** | deepseek-reasoner | Чат | Сервер ✅ |
| **Ollama** | qwen2.5:7b | Чат (локальный) | Dev ✅ |
| **Ollama** | nomic-embed-text | Эмбеддинги | Dev ✅ |
| **Anthropic** | claude-sonnet | OCR, резервный чат | Настроен ✅ |

### Права доступа (RBAC)

| Действие | Admin | Manager | Viewer |
|----------|:-----:|:-------:|:------:|
| Просмотр всех данных | ✅ | ✅ | ✅ |
| Создание сущностей | ✅ | ✅ | ❌ |
| Редактирование **своих** | ✅ | ✅ | ❌ |
| Редактирование **чужих** | ✅ | ❌ | ❌ |
| Удаление **своих** | ✅ | ✅ | ❌ |
| Удаление **чужих** | ✅ | ❌ | ❌ |
| Векторизация документов | ✅ | ❌ | ❌ |
| Настройки дашборда | ✅ | ❌ | ❌ |
| Управление пользователями | ✅ | ❌ | ❌ |

### Текущее состояние
- **Сервер:** http://217.198.9.249 (работает)
- **AI-чат:** Timeweb AI (DeepSeek Reasoner)
- **Авторизация:** JWT + RBAC + Entity Ownership
- **Данные:** 8 предприятий, 9 задач, 7 вех, 7 рисков
- **Пользователи:** 3 (admin, manager, viewer)
- **HTTPS:** в процессе (ожидание домена)

### Создание администратора

**Docker:** Добавьте в `.env.server`:
```
INIT_ADMIN_USERNAME=admin
INIT_ADMIN_EMAIL=admin@npf.ru
INIT_ADMIN_PASSWORD=your_secure_password
```

---

*Последнее обновление: 22 февраля 2026*
