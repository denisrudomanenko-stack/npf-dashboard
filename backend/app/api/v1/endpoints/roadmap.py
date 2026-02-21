from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.roadmap import RoadmapItem, Track, RoadmapStatus
from app.models.user import User
from app.schemas.roadmap import RoadmapItemCreate, RoadmapItemUpdate, RoadmapItemResponse
from app.auth.dependencies import get_current_active_user, require_manager, require_ownership

router = APIRouter()


@router.get("/", response_model=List[RoadmapItemResponse])
async def get_roadmap_items(
    skip: int = 0,
    limit: int = 100,
    track: Track = None,
    status: RoadmapStatus = None,
    year: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(RoadmapItem)
    if track:
        query = query.where(RoadmapItem.track == track)
    if status:
        query = query.where(RoadmapItem.status == status)
    if year:
        query = query.where(RoadmapItem.year == year)
    query = query.order_by(RoadmapItem.start_date).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/by-track/{track}", response_model=List[RoadmapItemResponse])
async def get_roadmap_by_track(
    track: Track,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(RoadmapItem).where(RoadmapItem.track == track).order_by(RoadmapItem.start_date)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{item_id}", response_model=RoadmapItemResponse)
async def get_roadmap_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    return item


@router.post("/", response_model=RoadmapItemResponse)
async def create_roadmap_item(
    item: RoadmapItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    db_item = RoadmapItem(**item.model_dump(), created_by_id=current_user.id)
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


@router.put("/{item_id}", response_model=RoadmapItemResponse)
async def update_roadmap_item(
    item_id: int,
    item: RoadmapItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == item_id))
    db_item = result.scalar_one_or_none()
    if not db_item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    # Check ownership (Admin can edit any, Manager can edit only own)
    require_ownership(db_item, current_user)

    for key, value in item.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)

    await db.commit()
    await db.refresh(db_item)
    return db_item


@router.delete("/{item_id}")
async def delete_roadmap_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    # Check ownership (Admin can delete any, Manager can delete only own)
    require_ownership(item, current_user)

    await db.delete(item)
    await db.commit()
    return {"message": "Roadmap item deleted"}


@router.patch("/{item_id}/status")
async def update_roadmap_status(
    item_id: int,
    status: RoadmapStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(RoadmapItem).where(RoadmapItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    # Check ownership (Admin can update any, Manager can update only own)
    require_ownership(item, current_user)

    item.status = status
    await db.commit()
    return {"message": f"Status updated to {status}"}
