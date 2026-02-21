from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any
import json

from app.database import get_db
from app.models import Enterprise, RoadmapItem, KPPContract, Risk, Milestone
from app.models.sales_data import SalesData
from app.models.dashboard_config import DashboardConfig
from app.models.user import User
from app.auth.dependencies import get_current_active_user, require_manager, require_ownership

router = APIRouter()


@router.get("/")
async def get_dashboard_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
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
    """Calculate KPI metrics using configs and sales data.

    Returns 3 groups of KPI:
    - bank: КПП в Банке (участники, проникновение, взносы работников, взносы банка)
    - external: Внешние продажи (предприятия, договоры, участники, взносы)
    - zk: Продажи в ЗК (количество ДДС, сумма взносов)

    Data sources:
    - bank: из таблицы sales_data (track=bank)
    - external.enterprises/contracts: из таблицы enterprises
    - external.participants/collections: из таблицы kpp_contracts
    - zk: из таблицы sales_data (track=zk)
    - penetration: расчёт participants / headcount × 100%
    """

    # Load KPI targets from config
    config_result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.key == "kpi_targets")
    )
    config = config_result.scalar_one_or_none()

    # Load bank settings (headcount for penetration calculation)
    bank_settings_result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.key == "bank_settings")
    )
    bank_settings_config = bank_settings_result.scalar_one_or_none()

    bank_headcount = 32000  # Default
    if bank_settings_config and bank_settings_config.value:
        try:
            bank_settings = json.loads(bank_settings_config.value)
            bank_headcount = bank_settings.get("headcount", 32000)
        except json.JSONDecodeError:
            pass

    # Default targets
    targets = {
        "bank_penetration_target": 17.0,
        "bank_participants_target": 30000,
        "bank_employee_contributions_target": 50.0,
        "bank_bank_contributions_target": 25.0,
        "external_enterprises_target": 50,
        "external_contracts_target": 40,
        "external_participants_target": 20000,
        "external_collections_target": 1500.0,
        "zk_dds_count_target": 5000,
        "zk_dds_collections_target": 500.0,
    }

    if config and config.value:
        try:
            targets.update(json.loads(config.value))
        except json.JSONDecodeError:
            pass

    # Get latest sales data for bank track
    bank_data_result = await db.execute(
        select(SalesData)
        .where(SalesData.track == "bank")
        .order_by(SalesData.date.desc())
        .limit(1)
    )
    bank_data = bank_data_result.scalar_one_or_none()
    bank_data_date = bank_data.date.isoformat() if bank_data and bank_data.date else None

    # Get latest sales data for ZK track
    zk_data_result = await db.execute(
        select(SalesData)
        .where(SalesData.track == "zk")
        .order_by(SalesData.date.desc())
        .limit(1)
    )
    zk_data = zk_data_result.scalar_one_or_none()
    zk_data_date = zk_data.date.isoformat() if zk_data and zk_data.date else None

    # Get latest sales data for external track
    external_data_result = await db.execute(
        select(SalesData)
        .where(SalesData.track == "external")
        .order_by(SalesData.date.desc())
        .limit(1)
    )
    external_data = external_data_result.scalar_one_or_none()
    external_data_date = external_data.date.isoformat() if external_data and external_data.date else None

    # Bank track data from sales_data
    bank_participants = bank_data.participants if bank_data else 0
    bank_employee_contributions = bank_data.employee_contributions if bank_data else 0
    bank_bank_contributions = bank_data.bank_contributions if bank_data else 0

    # Calculate penetration: participants / headcount × 100%
    bank_penetration = (bank_participants / bank_headcount * 100) if bank_headcount > 0 else 0

    # Calculate target penetration: target_participants / headcount × 100%
    bank_participants_target = int(targets.get("bank_participants_target", 0))
    bank_penetration_target = (bank_participants_target / bank_headcount * 100) if bank_headcount > 0 else 0

    # Calculate target employee contributions: 72000 руб × participants / 1_000_000 (в млн руб)
    bank_employee_contributions_target = 72000 * bank_participants_target / 1_000_000

    # ZK track data from sales_data
    zk_dds_count = zk_data.dds_count if zk_data else 0
    zk_dds_collections = zk_data.dds_collections if zk_data else 0

    # Calculate target ZK collections: 36000 руб × dds_count_target / 1_000_000 (в млн руб)
    zk_dds_count_target = int(targets.get("zk_dds_count_target", 0))
    zk_dds_collections_target = 36000 * zk_dds_count_target / 1_000_000

    # External: Count enterprises from DB
    enterprises_result = await db.execute(
        select(
            func.count(Enterprise.id).filter(Enterprise.sales_status != "planned").label("in_work"),
            func.count(Enterprise.id).label("total")
        )
    )
    ent_stats = enterprises_result.first()
    external_enterprises_in_work = ent_stats.in_work if ent_stats else 0
    external_enterprises_total = int(targets.get("external_enterprises_target", 50))

    # External: Count contracts from enterprises table
    contracts_result = await db.execute(
        select(func.count(Enterprise.id))
        .where(Enterprise.sales_status.in_(["contract", "launched"]))
    )
    external_contracts = contracts_result.scalar() or 0

    # External: Get participants and collections from kpp_contracts table
    kpp_stats_result = await db.execute(
        select(
            func.sum(KPPContract.participants_count).label("total_participants"),
            func.sum(KPPContract.collections).label("total_collections")
        )
        .where(KPPContract.status.in_(["signed", "active"]))
    )
    kpp_stats = kpp_stats_result.first()
    external_participants = int(kpp_stats.total_participants or 0) if kpp_stats else 0
    external_collections = float(kpp_stats.total_collections or 0) if kpp_stats else 0

    return {
        "bank": {
            "participants": {
                "current": bank_participants,
                "target": bank_participants_target
            },
            "penetration": {
                "current": round(bank_penetration, 1),
                "target": round(bank_penetration_target, 1)
            },
            "employeeContributions": {
                "current": round(bank_employee_contributions, 2),
                "target": round(bank_employee_contributions_target, 1)
            },
            "bankContributions": {
                "current": round(bank_bank_contributions, 2),
                "target": round(bank_employee_contributions_target, 1)
            },
            "dataDate": bank_data_date
        },
        "external": {
            "enterprises": {
                "inWork": external_enterprises_in_work,
                "total": external_enterprises_total
            },
            "contracts": {
                "current": external_contracts,
                "target": int(targets.get("external_contracts_target", 40))
            },
            "participants": {
                "current": external_participants,
                "target": int(targets.get("external_participants_target", 20000))
            },
            "collections": {
                "current": round(external_collections, 2),
                "target": targets.get("external_collections_target", 1500.0)
            },
            "dataDate": external_data_date
        },
        "zk": {
            "ddsCount": {
                "current": zk_dds_count,
                "target": zk_dds_count_target
            },
            "ddsCollections": {
                "current": round(zk_dds_collections, 2),
                "target": round(zk_dds_collections_target, 1)
            },
            "dataDate": zk_data_date
        }
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
            "status": status,
            "created_by_id": item.created_by_id
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
    stats = {row[0].value if row[0] else "planned": row[1] for row in result.all()}

    return {
        "planned": stats.get("planned", 0),
        "contact": stats.get("contact", 0),
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
            "mitigation": risk.mitigation or "",
            "created_by_id": risk.created_by_id
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
            "status": m.status.value if m.status else "planned",
            "created_by_id": m.created_by_id
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
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
        end_date=end_date,
        created_by_id=current_user.id
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
        "status": status,
        "created_by_id": item.created_by_id
    }


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Delete a timeline task."""
    from fastapi import HTTPException
    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == task_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check ownership (Admin can delete any, Manager can delete only own)
    require_ownership(item, current_user)

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Update a timeline task."""
    from fastapi import HTTPException
    from app.models.roadmap import Track, RoadmapStatus
    from datetime import date

    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == task_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check ownership (Admin can update any, Manager can update only own)
    require_ownership(item, current_user)

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
        "status": item.status.value if item.status else "planned",
        "created_by_id": item.created_by_id
    }


@router.post("/tasks/{task_id}/archive")
async def archive_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Archive a timeline task (set status to cancelled)."""
    from fastapi import HTTPException
    from app.models.roadmap import RoadmapStatus

    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == task_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check ownership (Admin can archive any, Manager can archive only own)
    require_ownership(item, current_user)

    item.status = RoadmapStatus.CANCELLED
    await db.commit()
    return {"message": "Task archived"}


@router.get("/tasks/archived")
async def get_archived_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
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
            "status": "cancelled",
            "created_by_id": item.created_by_id
        }
        for item in items
    ]


@router.post("/seed")
async def seed_dashboard_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Seed initial dashboard data (for development)."""

    # Check if data already exists
    existing = await db.execute(select(func.count(Enterprise.id)))
    if existing.scalar() > 0:
        return {"message": "Data already exists"}

    # Seed Enterprises
    enterprises_data = [
        {"name": 'ПАО "НПО Энергомаш"', "score": 112, "category": "A", "sales_status": "contract"},
        {"name": 'АО "РКК Энергия"', "score": 108, "category": "A", "sales_status": "contract"},
        {"name": 'АО "ИСС Решетнёва"', "score": 105, "category": "A", "sales_status": "launched"},
        {"name": 'ФГУП "ЦЭНКИ"', "score": 98, "category": "A", "sales_status": "contact"},
        {"name": 'АО "ГКНПЦ Хруничева"', "score": 95, "category": "B", "sales_status": "contact"},
        {"name": 'АО "Композит"', "score": 88, "category": "B", "sales_status": "contact"},
        {"name": 'ФГУП "НПО Техномаш"', "score": 82, "category": "B", "sales_status": "planned"},
        {"name": 'АО "НИИ ТП"', "score": 78, "category": "B", "sales_status": "contact"},
        {"name": 'АО "НПО Лавочкина"', "score": 72, "category": "V", "sales_status": "planned"},
        {"name": 'ФГУП "ЦНИИмаш"', "score": 68, "category": "V", "sales_status": "planned"},
        {"name": 'АО "Российские космические системы"', "score": 65, "category": "V", "sales_status": "planned"},
        {"name": 'ФГУП "НПЦАП"', "score": 45, "category": "G", "sales_status": "planned"},
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
