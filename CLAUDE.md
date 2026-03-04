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

# Production SSL (24pensi.ru)
docker compose -f docker-compose.ssl.yml --env-file .env.server up -d
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
- **LLM провайдеры:**
  - **Timeweb AI** (DeepSeek Reasoner + OpenSearch RAG)
  - **DeepSeek API** (прямой чат без RAG)
  - **Ollama** (локальный, эмбеддинги)
  - **Anthropic** (Claude API, OCR)
- **Pydantic** (validation)

### Infrastructure
- **Docker** + docker-compose (5 конфигураций: dev, prod, server, simple, ssl)
- **SQLite** (dev) / **PostgreSQL** (prod)
- **Nginx** (static serving, client_max_body_size: 50MB)
- **SSL:** Let's Encrypt (24pensi.ru)
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
├── docker-compose.ssl.yml  # Production SSL (24pensi.ru, Let's Encrypt)
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
- RAG-режим (ответы из базы знаний Timeweb OpenSearch)
- **Автогенерация названий чатов** через Timeweb AI (до 30 символов)
- Streaming responses (SSE)
- **3 LLM провайдера:** Timeweb AI, Ollama, Anthropic
- **Настройки LLM** (только для Admin):
  - Чат: выбор провайдера и модели
  - OCR: Claude Vision
  - Embeddings: Ollama nomic-embed-text
- **Индикаторы доступности** провайдеров (TW/OL/CL)

### RAG Queue (Очередь RAG)
- **Управление документами** для загрузки в Timeweb OpenSearch
- **Статусы:** Ожидает → В RAG / Отклонён / Не для RAG
- **Скачивание ZIP** ожидающих документов
- **Массовая отметка** как загруженных
- Доступ: только Admin

### Models (Финансовые модели)
- **Калькулятор МГД** — расчёт минимальной гарантированной доходности:
  - Транши с датами и суммами
  - Расчёт по траншам с time fraction
  - **Актуарный дефицит:** РППО, КБД, Номинал, корректировка МГД
  - **Два показателя:** покрытие обязательств + актуарный дефицит
  - Анализ чувствительности (доходность, гарантия, расходы)
  - Монте-Карло симуляция (вероятность дефицита, VaR 95%)
  - AI-рекомендации по митигации рисков
- Unit-экономика (в разработке)
- Стресс-тестирование (в разработке)
- Прогнозирование (в разработке)

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
| `backend/app/services/rag_service.py` | RAG + LLM логика (4 провайдера) |
| `backend/app/services/timeweb_ai_service.py` | Timeweb Cloud AI клиент (RAG) |
| `backend/app/services/deepseek_service.py` | DeepSeek API клиент (без RAG) |
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

# Timeweb AI (Cloud RAG)
TIMEWEB_AI_TOKEN=your-timeweb-jwt-token
TIMEWEB_AGENT_ID=your-agent-uuid
CHAT_PROVIDER=timeweb  # timeweb, ollama, or anthropic

# DeepSeek API (прямой чат без RAG)
DEEPSEEK_API_KEY=sk-your-deepseek-api-key

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
- [x] **Очередь RAG** — управление документами для Timeweb OpenSearch
- [x] **Автогенерация названий чатов** через Timeweb AI
- [x] **Калькулятор МГД** с расчётом актуарного дефицита
- [x] **Настройки LLM** — read-only для не-админов

### В планах

#### Приоритет 1: AI-функции
- [ ] ChromaDB для локального векторного поиска
- [ ] Ollama для эмбеддингов на сервере (nomic-embed-text)
- [ ] Интеллектуальный импорт Excel с LLM на сервере

#### Приоритет 2: Финансовые модели
- [ ] Unit-экономика клиента
- [ ] Стресс-тестирование портфеля
- [ ] Прогнозирование сборов и участников

#### Приоритет 3: Дополнительные функции
- [ ] Email уведомления
- [ ] Экспорт отчётов (PDF, Excel)
- [ ] Интеграции (1C, CRM)
- [ ] Telegram-бот для алертов

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
| **Домен** | https://24pensi.ru |
| **IP-адрес** | 217.198.9.249 |
| **SSH** | `ssh -i ~/.ssh/npf_server root@217.198.9.249` |
| **Статус** | ✅ Работает (HTTPS + JWT + RBAC) |
| **SSL** | Let's Encrypt (автопродление) |

### Запуск сервера
```bash
ssh -i ~/.ssh/npf_server root@217.198.9.249
cd /opt/npf-project
docker compose -f docker-compose.ssl.yml --env-file .env.server up -d
```

### Остановка сервера
```bash
ssh -i ~/.ssh/npf_server root@217.198.9.249
cd /opt/npf-project
docker compose -f docker-compose.ssl.yml down
```

### Обновление SSL-сертификата
```bash
# Сертификат обновляется автоматически через cron
# Ручное обновление:
certbot renew
docker compose -f docker-compose.ssl.yml restart frontend
```

---

## Последняя сессия (25 февраля 2026)

### Выполнено

#### 1. Калькулятор МГД — Актуарный дефицит
- **Новые входные параметры:**
  - РППО (резерв покрытия пенсионных обязательств)
  - КБД (кривая бескупонной доходности, % годовых)
  - Номинал (капитал для покрытия обязательств)
- **Замена параметра:** `mf%` → `Расходы и издержки` (дефолт 3%)
- **Новые расчёты:**
  ```
  Корректировка МГД = max(0, (КБД - r_gross) × РППО)
  Актуарные обязательства = РППО + Корректировка_МГД
  Актуарный дефицит = max(0, Актуарные_обязательства - Номинал)
  ```
- **Два выходных показателя:**
  - Покрытие обязательств (дефицит/профицит по гарантии)
  - Актуарный дефицит (сумма для докапитализации)
- Таблица детализации актуарного дефицита
- Обновлённые формулы и рекомендации

#### 2. Автогенерация названий чатов
- **Метод `generate_chat_title`** в `timeweb_ai_service.py`
- Использует Timeweb AI без RAG для генерации названия
- Название до 30 символов, отражает суть первого сообщения
- **Endpoint `/conversations/regenerate-titles`** — переименование всех чатов
- Fallback: обрезка сообщения если AI недоступен

#### 3. Очередь RAG (22 февраля)
- Страница `/settings/rag-queue` — управление документами для Timeweb RAG
- **Статусы документов:** pending → indexed / rejected / not_for_rag
- Скачивание ZIP ожидающих документов
- Массовая отметка как загруженных
- Статистика по статусам

#### 4. Настройки LLM — read-only для не-админов
- Manager/Viewer видят информацию о моделях без возможности изменения
- Сообщение "Настройки AI доступны только администраторам"

### Изменённые файлы

| Backend | Frontend |
|---------|----------|
| `app/services/timeweb_ai_service.py` | `pages/Models.tsx` |
| `app/api/v1/endpoints/conversations.py` | `pages/LLMSettings.tsx` |
| `app/api/v1/endpoints/documents.py` | `pages/RAGQueue.tsx` |
| `app/models/document.py` | `components/Layout.tsx` |

### Права доступа (RBAC)

| Действие | Admin | Manager | Sales | Viewer |
|----------|:-----:|:-------:|:-----:|:------:|
| Просмотр всех данных | ✅ | ✅ | ✅ | ✅ |
| **Просмотр Моделей** | ✅ | ✅ | ❌ | ✅ |
| Создание сущностей | ✅ | ✅ | ✅ | ❌ |
| Ввод/импорт данных продаж | ✅ | ✅ | ✅ | ❌ |
| Редактирование **своих** | ✅ | ✅ | ✅ | ❌ |
| Редактирование **чужих** | ✅ | ❌ | ❌ | ❌ |
| Удаление **своих** | ✅ | ✅ | ✅ | ❌ |
| Удаление **чужих** | ✅ | ❌ | ❌ | ❌ |
| Очередь RAG | ✅ | ❌ | ❌ | ❌ |
| Настройки LLM | ✅ | ❌ | ❌ | ❌ |
| Настройки дашборда | ✅ | ❌ | ❌ | ❌ |
| Управление пользователями | ✅ | ❌ | ❌ | ❌ |

### Текущее состояние (на 4 марта 2026)
- **Сервер:** https://24pensi.ru ✅
- **SSL:** Let's Encrypt (до 23.05.2026)
- **AI-чат:** Timeweb AI (DeepSeek Reasoner) с автогенерацией названий
- **Модели:** Калькулятор МГД с актуарным дефицитом
- **Авторизация:** JWT + RBAC + Entity Ownership (4 роли: admin, manager, sales, viewer)
- **Документы:** 11 файлов в RAG очереди
- **Пользователи:** 3 (AdminNpf, manager, viewer)

### API Endpoints (новые)

```
POST /api/v1/conversations/regenerate-titles  # Переименовать все чаты
GET  /api/v1/documents/rag-queue/stats        # Статистика RAG очереди
GET  /api/v1/documents/rag-queue/list         # Список документов по статусу
PATCH /api/v1/documents/{id}/rag-status       # Изменить RAG-статус
POST /api/v1/documents/rag-queue/mark-indexed # Массовая отметка
GET  /api/v1/documents/rag-queue/download     # Скачать ZIP ожидающих
POST /api/v1/sales-data/import/preview        # Предпросмотр импорта данных продаж
POST /api/v1/sales-data/import                # Импорт данных продаж из Excel/CSV
```

---

## Последняя сессия (1 марта 2026)

### Выполнено

#### 1. Новая роль "Продавец" (Sales)
- **Добавлена роль** `sales` в UserRole enum
- **Ограничения:** не видит страницу "Модели", редирект на Dashboard
- **Разрешено:** создание предприятий, ввод/импорт данных продаж, редактирование своих записей
- **Dependency** `require_sales_or_higher` для endpoints, доступных sales

#### 2. Импорт данных продаж из Excel/CSV
- **Endpoint preview:** `/api/v1/sales-data/import/preview` — LLM-маппинг колонок
- **Endpoint import:** `/api/v1/sales-data/import` — импорт с кастомным маппингом
- **LLM-модель:** qwen2.5:3b для автоматического сопоставления колонок
- **Fallback:** простой маппинг по алиасам если LLM недоступен
- **Обработка дубликатов:** skip / update / append
- **UI в DashboardSettingsModal:** кнопка импорта для каждого трека

### Изменённые файлы

| Backend | Frontend |
|---------|----------|
| `app/models/user.py` | `types/auth.ts` |
| `app/auth/dependencies.py` | `hooks/usePermissions.ts` |
| `app/api/v1/endpoints/sales_data.py` | `components/Layout.tsx` |
| `app/api/v1/endpoints/enterprises.py` | `components/UserMenu.tsx` |
| `app/schemas/sales_data.py` | `components/DashboardSettingsModal.tsx` |
| | `pages/Users.tsx` |
| | `pages/App.tsx` |
| | `types/index.ts` |

---

## Последняя сессия (4 марта 2026)

### Выполнено

#### 1. Исправление RAG Queue (критический баг)
- **Проблема:** 422 Unprocessable Entity на `/rag-queue/download`
- **Причина:** FastAPI сопоставлял `/rag-queue/download` как `/{document_id}/download`, где `document_id="rag-queue"` не проходил валидацию int
- **Решение:** Перенесли все RAG Queue routes ПЕРЕД `/{document_id}` в `documents.py`
- **Порядок маршрутов:**
  ```
  Line 146: /rag-queue/stats
  Line 182: /rag-queue/list
  Line 227: /rag-queue/download
  Line 271: /rag-queue/mark-indexed
  Line 294: /{document_id}  (ПОСЛЕ rag-queue routes)
  ```

#### 2. Синхронизация RAGStatus enum с PostgreSQL
- **Проблема:** Несоответствие регистра — БД хранила `PENDING` (uppercase), Python enum имел `pending` (lowercase)
- **Решение:** Обновили Python enum на uppercase значения:
  ```python
  class RAGStatus(str, enum.Enum):
      PENDING = "PENDING"
      INDEXED = "INDEXED"
      REJECTED = "REJECTED"
      NOT_FOR_RAG = "NOT_FOR_RAG"
  ```
- **Миграция локальной SQLite:** `UPDATE documents SET rag_status = UPPER(rag_status)`

#### 3. Деплой на production сервер
- **Команда:** `docker compose -f docker-compose.ssl.yml --env-file .env.server up -d`
- **Результат:** Backend пересобран и запущен
- **Документы:** 11 файлов сохранены в БД

### Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `backend/app/api/v1/endpoints/documents.py` | Перенос RAG Queue routes перед `/{document_id}` |
| `backend/app/models/document.py` | RAGStatus enum — uppercase значения |

### Текущее состояние
- **Сервер:** https://24pensi.ru ✅
- **Backend:** Работает (ed1a72715adf)
- **PostgreSQL:** 11 документов, все rag_status = PENDING
- **RAG Queue:** Исправлен, 422 ошибка устранена
- **Пользователи:** 3 (AdminNpf, manager, viewer)

### Важные технические решения

#### Порядок маршрутов в FastAPI
В FastAPI маршруты сопоставляются в порядке объявления. Параметризованные маршруты типа `/{document_id}` должны идти ПОСЛЕ конкретных путей:
```python
# ПРАВИЛЬНО:
@router.get("/rag-queue/stats")      # Конкретный путь — ПЕРВЫЙ
@router.get("/{document_id}")         # Параметризованный — ПОСЛЕДНИЙ

# НЕПРАВИЛЬНО (вызовет 422):
@router.get("/{document_id}")         # Перехватит /rag-queue/stats!
@router.get("/rag-queue/stats")       # Никогда не выполнится
```

#### Enum синхронизация SQLite ↔ PostgreSQL
- **SQLite:** Хранит enum как VARCHAR, регистр определяется Python
- **PostgreSQL:** Создаёт отдельный тип enum, регистр фиксирован
- **Решение:** Использовать uppercase значения в Python для совместимости

---

*Последнее обновление: 4 марта 2026*
