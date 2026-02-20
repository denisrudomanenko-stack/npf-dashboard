from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any

from app.database import get_db
from app.models import Enterprise, RoadmapItem, KPPContract, Risk, Milestone

router = APIRouter()


@router.get("/")
async def get_dashboard_data(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Get all dashboard data in a single request."""

    # KPI Data
    kpi = await get_kpi_data(db)

    # Timeline tasks from roadmap
    timeline = await get_timeline_tasks(db)

    # Enterprise pipeline
    pipeline = await get_pipeline_data(db)

    # Sales funnel
    funnel = await get_funnel_stats(db)

    # Risk matrix
    risks = await get_risks(db)

    # Milestones
    milestones = await get_milestones(db)

    return {
        "kpi": kpi,
        "timeline": timeline,
        "pipeline": pipeline,
        "funnel": funnel,
        "risks": risks,
        "milestones": milestones
    }


async def get_kpi_data(db: AsyncSession) -> Dict[str, Any]:
    """Calculate KPI metrics."""

    # Total collections from active contracts
    collections_result = await db.execute(
        select(func.sum(KPPContract.participants_count))
        .where(KPPContract.status == "active")
    )
    current_participants = collections_result.scalar() or 0

    # Count enterprises by status
    enterprises_result = await db.execute(
        select(
            func.count(Enterprise.id).filter(Enterprise.sales_status == "launched").label("launched"),
            func.count(Enterprise.id).label("total")
        )
    )
    ent_stats = enterprises_result.first()

    # Count active contracts
    contracts_result = await db.execute(
        select(func.count(KPPContract.id))
        .where(KPPContract.status == "active")
    )
    active_contracts = contracts_result.scalar() or 0

    # Calculate progress (based on milestones completed)
    progress_result = await db.execute(
        select(
            func.count(Milestone.id).filter(Milestone.status == "completed").label("completed"),
            func.count(Milestone.id).label("total")
        )
    )
    progress_stats = progress_result.first()
    progress_pct = 0
    if progress_stats and progress_stats.total > 0:
        progress_pct = int((progress_stats.completed / progress_stats.total) * 100)

    return {
        "collections": {
            "current": 0.8,  # TODO: Calculate from actual financial data
            "target": 3.0
        },
        "participants": {
            "current": current_participants,
            "target": 4500
        },
        "enterprises": {
            "inProgress": ent_stats.total - ent_stats.launched if ent_stats else 0,
            "total": ent_stats.total if ent_stats else 0
        },
        "progress": progress_pct
    }


async def get_timeline_tasks(db: AsyncSession) -> List[Dict[str, Any]]:
    """Get roadmap items formatted for timeline."""

    result = await db.execute(
        select(RoadmapItem)
        .order_by(RoadmapItem.start_date, RoadmapItem.id)
    )
    items = result.scalars().all()

    def get_quarter(date):
        if not date:
            return 1
        month = date.month
        return (month - 1) // 3 + 1

    tasks = []
    for item in items:
        # Map track enum to frontend values
        track = "external"
        if item.track and item.track.value == "internal_pilot":
            track = "internal"

        # Map status
        status = "planned"
        if item.status:
            if item.status.value == "completed":
                status = "completed"
            elif item.status.value == "in_progress":
                status = "in_progress"

        tasks.append({
            "id": str(item.id),
            "title": item.title,
            "startQ": get_quarter(item.start_date) if item.start_date else 1,
            "endQ": get_quarter(item.end_date) if item.end_date else 1,
            "track": track,
            "status": status
        })

    return tasks


async def get_pipeline_data(db: AsyncSession) -> Dict[str, List[Dict[str, Any]]]:
    """Get enterprises grouped by category."""

    result = await db.execute(
        select(Enterprise)
        .order_by(Enterprise.score.desc())
    )
    enterprises = result.scalars().all()

    pipeline = {"A": [], "B": [], "V": [], "G": []}

    for ent in enterprises:
        category = ent.category.value if ent.category else "V"
        if category in pipeline:
            pipeline[category].append({
                "id": ent.id,
                "name": ent.name,
                "score": ent.score or 0,
                "status": ent.sales_status.value if ent.sales_status else "contact"
            })

    return pipeline


async def get_funnel_stats(db: AsyncSession) -> Dict[str, int]:
    """Get sales funnel statistics."""

    result = await db.execute(
        select(Enterprise.sales_status, func.count(Enterprise.id))
        .group_by(Enterprise.sales_status)
    )
    stats = {row[0].value if row[0] else "contact": row[1] for row in result.all()}

    return {
        "contact": stats.get("contact", 0),
        "presentation": stats.get("presentation", 0),
        "negotiation": stats.get("negotiation", 0),
        "contract": stats.get("contract", 0),
        "launched": stats.get("launched", 0)
    }


async def get_risks(db: AsyncSession) -> List[Dict[str, Any]]:
    """Get active risks."""

    result = await db.execute(
        select(Risk)
        .where(Risk.status == "active")
        .order_by(Risk.id)
    )
    risks = result.scalars().all()

    return [
        {
            "id": str(risk.id),
            "title": risk.title,
            "probability": risk.probability.value if risk.probability else "medium",
            "impact": risk.impact.value if risk.impact else "medium",
            "mitigation": risk.mitigation or ""
        }
        for risk in risks
    ]


async def get_milestones(db: AsyncSession) -> List[Dict[str, Any]]:
    """Get milestones for current year."""

    result = await db.execute(
        select(Milestone)
        .where(Milestone.year == 2026)
        .order_by(Milestone.target_date, Milestone.id)
    )
    milestones = result.scalars().all()

    return [
        {
            "id": str(m.id),
            "month": m.month or "",
            "title": m.title,
            "status": m.status.value if m.status else "planned"
        }
        for m in milestones
    ]


@router.post("/tasks")
async def create_task(
    title: str,
    track: str,
    start_q: int,
    end_q: int,
    status: str = "planned",
    db: AsyncSession = Depends(get_db)
):
    """Create a new timeline task."""
    from app.models.roadmap import Track, RoadmapStatus
    from datetime import date

    # Map quarter to dates
    year = 2026
    quarter_dates = {
        1: (date(year, 1, 1), date(year, 3, 31)),
        2: (date(year, 4, 1), date(year, 6, 30)),
        3: (date(year, 7, 1), date(year, 9, 30)),
        4: (date(year, 10, 1), date(year, 12, 31)),
    }

    # Map track
    track_enum = Track.EXTERNAL_CLIENTS
    if track == "internal":
        track_enum = Track.INTERNAL_PILOT

    # Map status
    status_enum = RoadmapStatus.PLANNED
    if status == "in_progress":
        status_enum = RoadmapStatus.IN_PROGRESS
    elif status == "completed":
        status_enum = RoadmapStatus.COMPLETED

    start_date = quarter_dates[start_q][0]
    end_date = quarter_dates[end_q][1]

    item = RoadmapItem(
        title=title,
        track=track_enum,
        status=status_enum,
        start_date=start_date,
        end_date=end_date
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return {
        "id": str(item.id),
        "title": item.title,
        "startQ": start_q,
        "endQ": end_q,
        "track": track,
        "status": status
    }


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a timeline task."""
    from fastapi import HTTPException
    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == task_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Task deleted"}


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: int,
    title: str = None,
    track: str = None,
    start_q: int = None,
    end_q: int = None,
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Update a timeline task."""
    from fastapi import HTTPException
    from app.models.roadmap import Track, RoadmapStatus
    from datetime import date

    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == task_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Task not found")

    year = 2026
    quarter_dates = {
        1: (date(year, 1, 1), date(year, 3, 31)),
        2: (date(year, 4, 1), date(year, 6, 30)),
        3: (date(year, 7, 1), date(year, 9, 30)),
        4: (date(year, 10, 1), date(year, 12, 31)),
    }

    if title is not None:
        item.title = title
    if track is not None:
        item.track = Track.INTERNAL_PILOT if track == "internal" else Track.EXTERNAL_CLIENTS
    if start_q is not None:
        item.start_date = quarter_dates[start_q][0]
    if end_q is not None:
        item.end_date = quarter_dates[end_q][1]
    if status is not None:
        status_map = {
            "planned": RoadmapStatus.PLANNED,
            "in_progress": RoadmapStatus.IN_PROGRESS,
            "completed": RoadmapStatus.COMPLETED
        }
        item.status = status_map.get(status, RoadmapStatus.PLANNED)

    await db.commit()

    def get_quarter(d):
        if not d:
            return 1
        return (d.month - 1) // 3 + 1

    return {
        "id": str(item.id),
        "title": item.title,
        "startQ": get_quarter(item.start_date),
        "endQ": get_quarter(item.end_date),
        "track": "internal" if item.track == Track.INTERNAL_PILOT else "external",
        "status": item.status.value if item.status else "planned"
    }


@router.post("/tasks/{task_id}/archive")
async def archive_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """Archive a timeline task (set status to cancelled)."""
    from fastapi import HTTPException
    from app.models.roadmap import RoadmapStatus

    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == task_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Task not found")

    item.status = RoadmapStatus.CANCELLED
    await db.commit()
    return {"message": "Task archived"}


@router.get("/tasks/archived")
async def get_archived_tasks(db: AsyncSession = Depends(get_db)):
    """Get archived (cancelled) tasks."""
    from app.models.roadmap import RoadmapStatus, Track

    result = await db.execute(
        select(RoadmapItem)
        .where(RoadmapItem.status == RoadmapStatus.CANCELLED)
        .order_by(RoadmapItem.id.desc())
    )
    items = result.scalars().all()

    def get_quarter(date):
        if not date:
            return 1
        return (date.month - 1) // 3 + 1

    return [
        {
            "id": str(item.id),
            "title": item.title,
            "startQ": get_quarter(item.start_date),
            "endQ": get_quarter(item.end_date),
            "track": "internal" if item.track == Track.INTERNAL_PILOT else "external",
            "status": "cancelled"
        }
        for item in items
    ]


@router.post("/seed")
async def seed_dashboard_data(db: AsyncSession = Depends(get_db)):
    """Seed initial dashboard data (for development)."""

    # Check if data already exists
    existing = await db.execute(select(func.count(Enterprise.id)))
    if existing.scalar() > 0:
        return {"message": "Data already exists"}

    # Seed Enterprises
    enterprises_data = [
        {"name": 'ПАО "НПО Энергомаш"', "score": 112, "category": "A", "sales_status": "negotiation"},
        {"name": 'АО "РКК Энергия"', "score": 108, "category": "A", "sales_status": "presentation"},
        {"name": 'АО "ИСС Решетнёва"', "score": 105, "category": "A", "sales_status": "contract"},
        {"name": 'ФГУП "ЦЭНКИ"', "score": 98, "category": "A", "sales_status": "contact"},
        {"name": 'АО "ГКНПЦ Хруничева"', "score": 95, "category": "B", "sales_status": "presentation"},
        {"name": 'АО "Композит"', "score": 88, "category": "B", "sales_status": "contact"},
        {"name": 'ФГУП "НПО Техномаш"', "score": 82, "category": "B", "sales_status": "contact"},
        {"name": 'АО "НИИ ТП"', "score": 78, "category": "B", "sales_status": "presentation"},
        {"name": 'АО "НПО Лавочкина"', "score": 72, "category": "V", "sales_status": "contact"},
        {"name": 'ФГУП "ЦНИИмаш"', "score": 68, "category": "V", "sales_status": "contact"},
        {"name": 'АО "Российские космические системы"', "score": 65, "category": "V", "sales_status": "contact"},
        {"name": 'ФГУП "НПЦАП"', "score": 45, "category": "G", "sales_status": "contact"},
    ]

    for ent_data in enterprises_data:
        from app.models.enterprise import EnterpriseCategory, SalesStatus
        ent = Enterprise(
            name=ent_data["name"],
            score=ent_data["score"],
            category=EnterpriseCategory(ent_data["category"]),
            sales_status=SalesStatus(ent_data["sales_status"])
        )
        db.add(ent)

    # Seed Roadmap Items
    from app.models.roadmap import Track, RoadmapStatus
    from datetime import date

    roadmap_data = [
        {"title": "Юридический аудит целевого списка", "track": "external_clients", "status": "completed", "start": (2026, 1, 1), "end": (2026, 3, 31)},
        {"title": "Скоринг и приоритизация пула", "track": "external_clients", "status": "in_progress", "start": (2026, 1, 1), "end": (2026, 6, 30)},
        {"title": "Согласование модели с корпблоком", "track": "external_clients", "status": "completed", "start": (2026, 1, 1), "end": (2026, 3, 31)},
        {"title": "Переговоры категория А", "track": "external_clients", "status": "in_progress", "start": (2026, 1, 1), "end": (2026, 9, 30)},
        {"title": "Пилотные подключения", "track": "external_clients", "status": "planned", "start": (2026, 4, 1), "end": (2026, 9, 30)},
        {"title": "Категория Б — расширение воронки", "track": "external_clients", "status": "planned", "start": (2026, 4, 1), "end": (2026, 12, 31)},
        {"title": "Целевые кампании сотрудники Банка", "track": "internal_pilot", "status": "in_progress", "start": (2026, 1, 1), "end": (2026, 9, 30)},
        {"title": "Масштабирование программы Банка", "track": "internal_pilot", "status": "planned", "start": (2026, 7, 1), "end": (2026, 12, 31)},
        {"title": "Индустриализация процесса", "track": "external_clients", "status": "planned", "start": (2026, 7, 1), "end": (2026, 12, 31)},
    ]

    for rd in roadmap_data:
        item = RoadmapItem(
            title=rd["title"],
            track=Track(rd["track"]),
            status=RoadmapStatus(rd["status"]),
            start_date=date(*rd["start"]),
            end_date=date(*rd["end"])
        )
        db.add(item)

    # Seed Risks
    from app.models.risk import Probability, Impact, RiskStatus

    risks_data = [
        {"title": "Длинный цикл сделок", "probability": "high", "impact": "critical", "mitigation": "Front-loading переговоров в Q1"},
        {"title": "Вовлечённость корпблока", "probability": "high", "impact": "critical", "mitigation": "Включение КПП в KPI менеджеров"},
        {"title": "Нормативные блокеры", "probability": "medium", "impact": "high", "mitigation": "Юридический аудит до продаж"},
        {"title": "Низкая конверсия сотрудников", "probability": "medium", "impact": "high", "mitigation": "Сегментация, калькулятор выгоды"},
        {"title": "Бюджетный цикл", "probability": "high", "impact": "medium", "mitigation": "Раннее выявление, работа на 2027"},
        {"title": "Режимные ограничения", "probability": "medium", "impact": "medium", "mitigation": "Работа через внутренних агентов"},
        {"title": "Текучка персонала", "probability": "medium", "impact": "medium", "mitigation": "Механизм vesting"},
    ]

    for rd in risks_data:
        risk = Risk(
            title=rd["title"],
            probability=Probability(rd["probability"]),
            impact=Impact(rd["impact"]),
            mitigation=rd["mitigation"],
            status=RiskStatus.ACTIVE
        )
        db.add(risk)

    # Seed Milestones
    from app.models.milestone import MilestoneStatus

    milestones_data = [
        {"month": "Янв", "title": "Согласование модели с корпблоком", "status": "completed"},
        {"month": "Фев", "title": "Юридический аудит завершён", "status": "completed"},
        {"month": "Мар", "title": "Скоринг-матрица заполнена", "status": "in_progress"},
        {"month": "Апр", "title": "Первые 3 договора категории А", "status": "planned"},
        {"month": "Июн", "title": "Запуск первого потока взносов", "status": "planned"},
        {"month": "Сен", "title": "15 активных предприятий", "status": "planned"},
        {"month": "Дек", "title": "Выполнение плана 3 млрд", "status": "planned"},
    ]

    for md in milestones_data:
        milestone = Milestone(
            month=md["month"],
            title=md["title"],
            status=MilestoneStatus(md["status"]),
            year=2026
        )
        db.add(milestone)

    await db.commit()

    return {"message": "Dashboard data seeded successfully"}
