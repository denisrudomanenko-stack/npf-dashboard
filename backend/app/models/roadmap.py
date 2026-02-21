from sqlalchemy import Column, Integer, String, Date, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class Track(str, enum.Enum):
    INTERNAL_PILOT = "internal_pilot"  # Пилот на сотрудниках банка
    EXTERNAL_CLIENTS = "external_clients"  # Внешние корпклиенты


class RoadmapStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class RoadmapItem(Base):
    __tablename__ = "roadmap_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(2000))
    track = Column(SQLEnum(Track), nullable=False)
    status = Column(SQLEnum(RoadmapStatus), default=RoadmapStatus.PLANNED)

    start_date = Column(Date)
    end_date = Column(Date)

    quarter = Column(String(10))  # Q1 2026, Q2 2026, etc.
    year = Column(Integer)

    dependencies = Column(String(500))  # JSON array of item IDs
    responsible = Column(String(255))
    priority = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Owner (for permission checks)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])
