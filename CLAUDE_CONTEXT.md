# NPF Project - Контекст для Claude

> **Прочитай этот файл в начале каждой сессии!**

## Быстрый старт сессии

```bash
# Проверка состояния проекта
./scripts/session-start.sh
```

## Текущее состояние проекта

### Стек технологий
- **Backend**: FastAPI + SQLAlchemy (async) + SQLite
- **Frontend**: React + TypeScript + Vite
- **RAG**: ChromaDB + Ollama/Anthropic
- **Деплой**: Docker Compose

### Порты (Docker)
- Frontend: http://localhost:3100
- Backend API: http://localhost:8100
- Ollama: http://localhost:11435

### Структура данных на диске
```
NPF-project/
├── db/npf.db              # SQLite база данных
├── chroma_db/             # Векторный индекс ChromaDB
├── data/documents/        # Загруженные документы
├── backups/               # Бэкапы (создаются автоматически)
└── docs/                  # Документация проекта
```

## Последние изменения

### 2026-02-20
- Реализован настраиваемый реестр предприятий (E1)
  - Drag-and-drop столбцов (dnd-kit)
  - Сортировка по клику на заголовок
  - Сохранение конфигурации в БД
  - API: `/api/v1/table-config/{table_name}`
- Добавлено редактирование взаимодействий
- Добавлено поле "Ответственный менеджер"
- Исправлена проблема с Docker volumes (данные теперь на диске хоста)

## Ключевые файлы

| Файл | Описание |
|------|----------|
| `backend/app/main.py` | Точка входа API, роутеры |
| `backend/app/models/` | SQLAlchemy модели |
| `backend/app/api/v1/endpoints/` | API эндпоинты |
| `frontend/src/pages/Enterprises.tsx` | Страница предприятий |
| `docker-compose.yml` | Конфигурация Docker |

## Известные особенности

1. **Docker volumes**: БД и ChromaDB монтируются с хоста (./db, ./chroma_db)
2. **TypeScript strict**: Используется строгая типизация, не оставлять неиспользуемые переменные
3. **CSS**: Inline styles в компонентах React (style tag внутри JSX)

## План работ (Roadmap)

### Предприятия
- [x] E1: Настраиваемый реестр (столбцы, сортировка)
- [x] E2: Карточка клиента
- [x] E3: Переименование предприятия
- [ ] E4: Динамические поля в БД

### Дашборд
- [ ] D1: KPI-карточки
- [ ] D2: Графики и аналитика

### Модели
- [ ] M1: Улучшение калькулятора
- [ ] M2: Экспорт расчётов
- [ ] M3: Сохранение сценариев

## Команды для работы

```bash
# Запустить проект
docker compose up -d

# Пересобрать после изменений
docker compose build && docker compose up -d

# Логи backend
docker compose logs -f backend

# Проверить API
curl http://localhost:8100/api/v1/health

# Бэкап данных
./scripts/backup.sh

# Завершить сессию
./scripts/session-end.sh "Описание изменений"
```

## Контакты и ресурсы

- Документация: `./docs/`
- API документация: http://localhost:8100/docs
