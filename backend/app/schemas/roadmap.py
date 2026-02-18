from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.models.roadmap import Track, RoadmapStatus


class RoadmapItemBase(BaseModel):
    title: str
    description: Optional[str] = None
    track: Track
    status: Optional[RoadmapStatus] = RoadmapStatus.PLANNED
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    quarter: Optional[str] = None
    year: Optional[int] = None
    dependencies: Optional[str] = None
    responsible: Optional[str] = None
    priority: Optional[int] = 0


class RoadmapItemCreate(RoadmapItemBase):
    pass


class RoadmapItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    track: Optional[Track] = None
    status: Optional[RoadmapStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    quarter: Optional[str] = None
    year: Optional[int] = None
    dependencies: Optional[str] = None
    responsible: Optional[str] = None
    priority: Optional[int] = None


class RoadmapItemResponse(RoadmapItemBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
