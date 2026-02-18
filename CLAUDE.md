# NPF Development Project

## Project Context

Веб-приложение для планирования и отслеживания развития корпоративного блока Негосударственного пенсионного фонда (НПФ).

### Business Context
- **НПФ** в периметре крупного Банка-монополиста
- **Captive audience** — замкнутая экосистема B2B + B2C
- **Основной продукт:** ПДС (Программа долгосрочных сбережений)
- **Новое направление:** Корпоративные пенсионные программы (КПП)

### Key Features
1. **Дорожная карта** — планирование развития на 2026–2027
2. **Два трека:** пилот на сотрудниках банка + внешние корпклиенты
3. **RAG-система** — база знаний по НПО, регламентам, продуктам
4. **Загрузка данных** — через файлы (Excel, CSV, PDF, DOCX)
5. **Аналитика воронки** — отслеживание продаж КПП

---

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (bundler)
- Zustand (state management)
- React Router DOM
- Axios

### Backend
- Python 3.9+ / FastAPI
- SQLAlchemy + aiosqlite (async SQLite)
- Alembic (migrations)
- Pydantic (validation)
- ChromaDB (vector store)
- Anthropic SDK (Claude API)

### Infrastructure
- Docker + docker-compose
- GitHub (version control)
- VPS deployment (planned)

---

## Project Structure

```
NPF-project/
├── frontend/           # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── backend/            # FastAPI
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   └── requirements.txt
├── docs/               # Documentation
│   ├── architecture/
│   ├── api/
│   └── tasks/
├── docker/             # Docker configs
├── data/               # RAG knowledge base files
└── CLAUDE.md           # This file
```

---

## Data Model (Core Entities)

### Enterprises (Предприятия)
- id, name, industry, employee_count
- bank_penetration (% зарплатного проекта)
- status (prospect, negotiation, pilot, active)
- locations[]

### Roadmap Items (Элементы дорожной карты)
- id, title, description
- track (internal_pilot | external_clients)
- start_date, end_date
- status, dependencies[]

### KPP Contracts (Договоры КПП)
- id, enterprise_id
- contract_date, participants_count
- contribution_scheme

### Documents (RAG)
- id, filename, content_hash
- status (active | archived | deleted)
- indexed_at, metadata

---

## Key Files

- `backend/app/main.py` — FastAPI entrypoint
- `backend/app/services/rag_service.py` — RAG logic
- `frontend/src/App.tsx` — React entrypoint
- `frontend/src/stores/` — Zustand stores
- `.env` — environment variables (not in git)

---

## Commands

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Docker (full stack)
docker-compose up --build
```

---

## Current Sprint / TODO

- [ ] Initialize Git repository
- [ ] Setup backend structure (FastAPI + SQLAlchemy)
- [ ] Setup frontend structure (React + Vite)
- [ ] Create data models (Enterprises, Roadmap, KPP)
- [ ] Implement RAG service
- [ ] File upload endpoints (Excel, CSV, PDF)
- [ ] Roadmap visualization component

---

## Conventions

- Commits: conventional commits (feat:, fix:, docs:)
- Branches: feature/*, bugfix/*, hotfix/*
- API: RESTful, prefix /api/v1/
- Code style: Python — black, isort; TS — eslint, prettier
