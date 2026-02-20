from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import pandas as pd
import io

from app.database import get_db
from app.models.enterprise import Enterprise, EnterpriseStatus
from app.models.interaction import Interaction
from app.schemas.enterprise import EnterpriseCreate, EnterpriseUpdate, EnterpriseResponse, InteractionCreate, InteractionResponse

router = APIRouter()


@router.get("/", response_model=List[EnterpriseResponse])
async def get_enterprises(
    skip: int = 0,
    limit: int = 100,
    status: EnterpriseStatus = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Enterprise).options(selectinload(Enterprise.interactions))
    if status:
        query = query.where(Enterprise.status == status)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{enterprise_id}", response_model=EnterpriseResponse)
async def get_enterprise(enterprise_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Enterprise)
        .options(selectinload(Enterprise.interactions))
        .where(Enterprise.id == enterprise_id)
    )
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return enterprise


@router.post("/", response_model=EnterpriseResponse)
async def create_enterprise(
    enterprise: EnterpriseCreate,
    db: AsyncSession = Depends(get_db)
):
    db_enterprise = Enterprise(**enterprise.model_dump())
    db.add(db_enterprise)
    await db.commit()
    await db.refresh(db_enterprise)
    return db_enterprise


@router.put("/{enterprise_id}", response_model=EnterpriseResponse)
async def update_enterprise(
    enterprise_id: int,
    enterprise: EnterpriseUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Enterprise).where(Enterprise.id == enterprise_id))
    db_enterprise = result.scalar_one_or_none()
    if not db_enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    for key, value in enterprise.model_dump(exclude_unset=True).items():
        setattr(db_enterprise, key, value)

    await db.commit()
    await db.refresh(db_enterprise)
    return db_enterprise


@router.delete("/{enterprise_id}")
async def delete_enterprise(enterprise_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Enterprise).where(Enterprise.id == enterprise_id))
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    await db.delete(enterprise)
    await db.commit()
    return {"message": "Enterprise deleted"}


@router.post("/import")
async def import_enterprises(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Import enterprises from Excel/CSV file"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="File must be Excel or CSV")

    contents = await file.read()

    if file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents))

    imported = 0
    for _, row in df.iterrows():
        enterprise = Enterprise(
            name=row.get('name', row.get('Наименование', '')),
            industry=row.get('industry', row.get('Отрасль', '')),
            employee_count=int(row.get('employee_count', row.get('Численность', 0)) or 0),
            bank_penetration=float(row.get('bank_penetration', row.get('Проникновение ЗП', 0)) or 0),
            locations=str(row.get('locations', row.get('Площадки', ''))),
        )
        db.add(enterprise)
        imported += 1

    await db.commit()
    return {"message": f"Imported {imported} enterprises"}


# --- Interactions ---

@router.get("/{enterprise_id}/interactions", response_model=List[InteractionResponse])
async def get_interactions(enterprise_id: int, db: AsyncSession = Depends(get_db)):
    """Get all interactions for an enterprise"""
    result = await db.execute(
        select(Interaction)
        .where(Interaction.enterprise_id == enterprise_id)
        .order_by(Interaction.date.desc())
    )
    return result.scalars().all()


@router.post("/{enterprise_id}/interactions", response_model=InteractionResponse)
async def create_interaction(
    enterprise_id: int,
    interaction: InteractionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a new interaction to an enterprise"""
    # Check enterprise exists
    result = await db.execute(select(Enterprise).where(Enterprise.id == enterprise_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Enterprise not found")

    db_interaction = Interaction(
        enterprise_id=enterprise_id,
        **interaction.model_dump()
    )
    db.add(db_interaction)
    await db.commit()
    await db.refresh(db_interaction)
    return db_interaction


@router.put("/{enterprise_id}/interactions/{interaction_id}", response_model=InteractionResponse)
async def update_interaction(
    enterprise_id: int,
    interaction_id: int,
    interaction_data: InteractionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update an interaction"""
    result = await db.execute(
        select(Interaction)
        .where(Interaction.id == interaction_id, Interaction.enterprise_id == enterprise_id)
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    for key, value in interaction_data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(interaction, key, value)

    await db.commit()
    await db.refresh(interaction)
    return interaction


@router.delete("/{enterprise_id}/interactions/{interaction_id}")
async def delete_interaction(
    enterprise_id: int,
    interaction_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an interaction"""
    result = await db.execute(
        select(Interaction)
        .where(Interaction.id == interaction_id, Interaction.enterprise_id == enterprise_id)
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    await db.delete(interaction)
    await db.commit()
    return {"message": "Interaction deleted"}
