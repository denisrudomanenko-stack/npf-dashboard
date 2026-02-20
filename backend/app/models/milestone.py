from sqlalchemy import Column, Integer, String, Date, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum


class MilestoneStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(2000))

    target_date = Column(Date)
    completed_date = Column(Date)

    status = Column(SQLEnum(MilestoneStatus), default=MilestoneStatus.PLANNED)
    year = Column(Integer, default=2026)
    month = Column(String(10))  # Янв, Фев, Мар, etc.

    owner = Column(String(255))
    notes = Column(String(1000))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
