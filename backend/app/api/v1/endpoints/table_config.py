from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from app.database import get_db
from app.models.table_config import TableConfig
from app.schemas.table_config import TableConfigCreate, TableConfigResponse, TableSettings, ColumnConfig

router = APIRouter()

# Default columns for enterprises table
DEFAULT_ENTERPRISES_COLUMNS = [
    ColumnConfig(id="category", label="Категория", visible=True, sortable=True),
    ColumnConfig(id="name", label="Наименование", visible=True, sortable=True),
    ColumnConfig(id="industry", label="Отрасль", visible=True, sortable=True),
    ColumnConfig(id="employee_count", label="Численность", visible=True, sortable=True),
    ColumnConfig(id="manager", label="Менеджер", visible=True, sortable=True),
    ColumnConfig(id="score", label="Балл", visible=True, sortable=True),
    ColumnConfig(id="sales_status", label="Этап продаж", visible=True, sortable=True),
    ColumnConfig(id="status", label="Статус", visible=True, sortable=True),
    ColumnConfig(id="bank_penetration", label="Проникн. ЗП", visible=False, sortable=True),
    ColumnConfig(id="locations", label="Площадки", visible=False, sortable=False),
    ColumnConfig(id="contact_person", label="Контакт", visible=False, sortable=True),
    ColumnConfig(id="contact_phone", label="Телефон", visible=False, sortable=False),
    ColumnConfig(id="contact_email", label="Email", visible=False, sortable=False),
]

DEFAULT_CONFIG = TableSettings(
    columns=DEFAULT_ENTERPRISES_COLUMNS,
    sortBy=None,
    sortOrder="asc"
)


@router.get("/{table_name}", response_model=TableConfigResponse)
async def get_table_config(table_name: str, db: AsyncSession = Depends(get_db)):
    """Get table configuration. Returns default if not exists."""
    result = await db.execute(
        select(TableConfig).where(TableConfig.table_name == table_name)
    )
    config = result.scalar_one_or_none()

    if not config:
        # Return default config without saving
        return TableConfigResponse(
            id=0,
            table_name=table_name,
            config=DEFAULT_CONFIG if table_name == "enterprises" else TableSettings(columns=[], sortBy=None, sortOrder="asc")
        )

    # Parse JSON config
    config_data = json.loads(config.config)
    return TableConfigResponse(
        id=config.id,
        table_name=config.table_name,
        config=TableSettings(**config_data),
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.put("/{table_name}", response_model=TableConfigResponse)
async def save_table_config(
    table_name: str,
    data: TableConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    """Save table configuration. Creates or updates."""
    result = await db.execute(
        select(TableConfig).where(TableConfig.table_name == table_name)
    )
    config = result.scalar_one_or_none()

    config_json = json.dumps(data.config.model_dump())

    if config:
        # Update existing
        config.config = config_json
    else:
        # Create new
        config = TableConfig(
            table_name=table_name,
            config=config_json
        )
        db.add(config)

    await db.commit()
    await db.refresh(config)

    return TableConfigResponse(
        id=config.id,
        table_name=config.table_name,
        config=data.config,
        created_at=config.created_at,
        updated_at=config.updated_at
    )


@router.delete("/{table_name}")
async def reset_table_config(table_name: str, db: AsyncSession = Depends(get_db)):
    """Delete table configuration (resets to default)."""
    result = await db.execute(
        select(TableConfig).where(TableConfig.table_name == table_name)
    )
    config = result.scalar_one_or_none()

    if config:
        await db.delete(config)
        await db.commit()

    return {"message": "Configuration reset to default"}
