from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models.sales_data import SalesData
from app.models.user import User
from app.schemas.sales_data import (
    SalesDataCreate,
    SalesDataUpdate,
    SalesDataResponse,
    SalesDataAggregated,
    SalesDataBulkImport,
    TrackType,
)
from app.auth.dependencies import get_current_active_user, require_manager

router = APIRouter()


@router.get("/", response_model=List[SalesDataResponse])
async def list_sales_data(
    track: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    period_type: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить список данных продаж с фильтрацией."""
    query = select(SalesData)

    filters = []
    if track:
        filters.append(SalesData.track == track)
    if start_date:
        filters.append(SalesData.date >= start_date)
    if end_date:
        filters.append(SalesData.date <= end_date)
    if period_type:
        filters.append(SalesData.period_type == period_type)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(SalesData.date.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/latest", response_model=dict)
async def get_latest_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить последние данные продаж по каждому треку."""
    result = {}

    for track in ["bank", "external", "zk"]:
        query_result = await db.execute(
            select(SalesData)
            .where(SalesData.track == track)
            .order_by(SalesData.date.desc())
            .limit(1)
        )
        data = query_result.scalar_one_or_none()
        if data:
            result[track] = SalesDataResponse.model_validate(data)

    return result


@router.get("/aggregated", response_model=List[SalesDataAggregated])
async def get_aggregated_data(
    track: Optional[str] = None,
    group_by: str = Query(default="month", enum=["week", "month", "quarter"]),
    year: int = 2026,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить агрегированные данные по периодам."""
    from sqlalchemy import extract, literal_column
    from app.database import DATABASE_URL

    is_postgres = DATABASE_URL.startswith("postgresql")

    if is_postgres:
        # PostgreSQL date functions
        if group_by == "month":
            period_expr = func.to_char(SalesData.date, 'YYYY-MM')
        elif group_by == "quarter":
            period_expr = func.concat(
                func.to_char(SalesData.date, 'YYYY'),
                '-Q',
                func.to_char(SalesData.date, 'Q')
            )
        else:  # week
            period_expr = func.to_char(SalesData.date, 'YYYY-"W"IW')

        year_filter = extract('year', SalesData.date) == year
    else:
        # SQLite date functions
        if group_by == "month":
            period_expr = func.strftime("%Y-%m", SalesData.date)
        elif group_by == "quarter":
            period_expr = func.strftime("%Y-Q", SalesData.date) + (
                (func.cast(func.strftime("%m", SalesData.date), type_=func.Integer) - 1) / 3 + 1
            ).cast(type_=func.String)
        else:  # week
            period_expr = func.strftime("%Y-W%W", SalesData.date)

        year_filter = func.strftime("%Y", SalesData.date) == str(year)

    filters = [year_filter]
    if track:
        filters.append(SalesData.track == track)

    result = await db.execute(
        select(
            period_expr.label("period"),
            SalesData.track,
            func.sum(SalesData.collections).label("collections"),
            func.sum(SalesData.participants).label("participants"),
            func.avg(SalesData.penetration).label("penetration"),
            func.max(SalesData.enterprises).label("enterprises"),
            func.sum(SalesData.contracts).label("contracts"),
        )
        .where(and_(*filters))
        .group_by(period_expr, SalesData.track)
        .order_by(period_expr)
    )

    rows = result.all()
    return [
        SalesDataAggregated(
            period=row.period or "",
            track=row.track or "bank",
            collections=row.collections or 0,
            participants=row.participants or 0,
            penetration=round(row.penetration or 0, 2),
            enterprises=row.enterprises or 0,
            contracts=row.contracts or 0,
        )
        for row in rows
    ]


@router.get("/{sales_id}", response_model=SalesDataResponse)
async def get_sales_data(
    sales_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить данные продаж по ID."""
    result = await db.execute(
        select(SalesData).where(SalesData.id == sales_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sales data not found")
    return item


@router.post("/", response_model=SalesDataResponse)
async def create_sales_data(
    data: SalesDataCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Создать новую запись данных продаж."""
    item = SalesData(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/bulk", response_model=List[SalesDataResponse])
async def bulk_import_sales_data(
    bulk_data: SalesDataBulkImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Массовый импорт данных продаж."""
    items = []
    for data in bulk_data.data:
        item = SalesData(**data.model_dump())
        db.add(item)
        items.append(item)

    await db.commit()

    for item in items:
        await db.refresh(item)

    return items


@router.put("/{sales_id}", response_model=SalesDataResponse)
async def update_sales_data(
    sales_id: int,
    data: SalesDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Обновить данные продаж."""
    result = await db.execute(
        select(SalesData).where(SalesData.id == sales_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sales data not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{sales_id}")
async def delete_sales_data(
    sales_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Удалить данные продаж."""
    result = await db.execute(
        select(SalesData).where(SalesData.id == sales_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sales data not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Sales data deleted"}


