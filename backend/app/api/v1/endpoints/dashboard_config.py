from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import json

from app.database import get_db
from app.models.dashboard_config import DashboardConfig
from app.schemas.dashboard_config import (
    DashboardConfigCreate,
    DashboardConfigUpdate,
    DashboardConfigResponse,
)

router = APIRouter()


def parse_config_value(config: DashboardConfig) -> dict:
    """Parse JSON value from config."""
    if config.value:
        try:
            return json.loads(config.value)
        except json.JSONDecodeError:
            return {}
    return {}


def config_to_response(config: DashboardConfig) -> DashboardConfigResponse:
    """Convert config model to response."""
    return DashboardConfigResponse(
        id=config.id,
        key=config.key,
        value=parse_config_value(config),
        description=config.description,
        category=config.category,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.get("/", response_model=List[DashboardConfigResponse])
async def list_configs(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех конфигураций."""
    query = select(DashboardConfig)
    if category:
        query = query.where(DashboardConfig.category == category)
    query = query.order_by(DashboardConfig.category, DashboardConfig.key)

    result = await db.execute(query)
    configs = result.scalars().all()

    return [config_to_response(c) for c in configs]


@router.get("/{key}", response_model=DashboardConfigResponse)
async def get_config(key: str, db: AsyncSession = Depends(get_db)):
    """Получить конфигурацию по ключу."""
    result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.key == key)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"Config '{key}' not found")
    return config_to_response(config)


@router.put("/{key}", response_model=DashboardConfigResponse)
async def update_config(
    key: str,
    data: DashboardConfigUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Обновить конфигурацию по ключу."""
    result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.key == key)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail=f"Config '{key}' not found")

    config.value = json.dumps(data.value, ensure_ascii=False)
    if data.description is not None:
        config.description = data.description

    await db.commit()
    await db.refresh(config)
    return config_to_response(config)


@router.post("/", response_model=DashboardConfigResponse)
async def create_config(
    data: DashboardConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    """Создать новую конфигурацию."""
    # Check if key exists
    existing = await db.execute(
        select(DashboardConfig).where(DashboardConfig.key == data.key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Config '{data.key}' already exists")

    config = DashboardConfig(
        key=data.key,
        value=json.dumps(data.value, ensure_ascii=False),
        description=data.description,
        category=data.category.value,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config_to_response(config)


@router.delete("/{key}")
async def delete_config(key: str, db: AsyncSession = Depends(get_db)):
    """Удалить конфигурацию."""
    result = await db.execute(
        select(DashboardConfig).where(DashboardConfig.key == key)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail=f"Config '{key}' not found")

    await db.delete(config)
    await db.commit()
    return {"message": f"Config '{key}' deleted"}


@router.post("/seed")
async def seed_default_configs(db: AsyncSession = Depends(get_db)):
    """Заполнить конфигурации значениями по умолчанию."""

    DEFAULT_CONFIGS = [
        {
            "key": "kpi_targets",
            "category": "kpi",
            "description": "Целевые значения KPI по направлениям",
            "value": {
                "bank_participants_target": 0,
                "bank_penetration_target": 0,
                "bank_employee_contributions_target": 0,
                "bank_bank_contributions_target": 0,
                "external_enterprises_target": 0,
                "external_contracts_target": 0,
                "external_participants_target": 0,
                "external_collections_target": 0,
                "zk_dds_count_target": 0,
                "zk_dds_collections_target": 0
            }
        },
        {
            "key": "scoring_rules",
            "category": "scoring",
            "description": "Правила расчёта скоринга предприятий",
            "value": {
                "employee_count": {
                    "weight": 0.30,
                    "thresholds": [],
                    "points": []
                },
                "bank_penetration": {
                    "weight": 0.25,
                    "thresholds": [],
                    "points": []
                },
                "industry": {
                    "weight": 0.20,
                    "priority": [],
                    "points": []
                },
                "status": {
                    "weight": 0.25,
                    "values": {}
                }
            }
        },
        {
            "key": "category_rules",
            "category": "scoring",
            "description": "Правила категоризации предприятий",
            "value": {
                "A": {"min_score": 80, "max_score": 100, "label": "", "color": "#22c55e"},
                "B": {"min_score": 60, "max_score": 79, "label": "", "color": "#3b82f6"},
                "V": {"min_score": 40, "max_score": 59, "label": "", "color": "#f59e0b"},
                "G": {"min_score": 0, "max_score": 39, "label": "", "color": "#ef4444"}
            }
        },
        {
            "key": "risk_matrix",
            "category": "risks",
            "description": "Настройки матрицы рисков",
            "value": {
                "probability_levels": [],
                "impact_levels": [],
                "color_scheme": {
                    "low": "#4caf50",
                    "medium": "#ff9800",
                    "high": "#f44336"
                },
                "severity_thresholds": {
                    "low": 0,
                    "medium": 0,
                    "high": 0
                }
            }
        },
        {
            "key": "formulas",
            "category": "formulas",
            "description": "Формулы расчёта метрик",
            "value": {
                "penetration": {
                    "formula": "participants / headcount * 100",
                    "description": "Процент проникновения КПП в Банке"
                }
            }
        },
        {
            "key": "pipeline_limits",
            "category": "kpi",
            "description": "Лимиты по категориям pipeline",
            "value": {
                "A": {"max": 0, "target": 0},
                "B": {"max": 0, "target": 0},
                "V": {"max": 0, "target": 0},
                "G": {"max": 0, "target": 0}
            }
        },
        {
            "key": "data_sources",
            "category": "data_sources",
            "description": "Источники данных для дашборда",
            "value": {
                "sales_data": {
                    "source": "manual",
                    "description": "Ручной ввод в разделе Настройки → Данные продаж"
                },
                "enterprises": {
                    "source": "database",
                    "description": "Из таблицы предприятий"
                },
                "contracts": {
                    "source": "database",
                    "description": "Из таблицы КПП договоров"
                }
            }
        },
        {
            "key": "bank_settings",
            "category": "kpi",
            "description": "Настройки Банка для расчёта KPI",
            "value": {
                "headcount": 0,
                "headcount_date": "",
                "history": []
            }
        }
    ]

    created = 0
    skipped = 0

    for config_data in DEFAULT_CONFIGS:
        existing = await db.execute(
            select(DashboardConfig).where(DashboardConfig.key == config_data["key"])
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        config = DashboardConfig(
            key=config_data["key"],
            value=json.dumps(config_data["value"], ensure_ascii=False),
            description=config_data["description"],
            category=config_data["category"],
        )
        db.add(config)
        created += 1

    await db.commit()
    return {"message": f"Configs seeded: {created} created, {skipped} skipped"}
