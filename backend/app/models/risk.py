from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum


class Probability(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Impact(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskStatus(str, enum.Enum):
    ACTIVE = "active"
    MITIGATED = "mitigated"
    CLOSED = "closed"


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(2000))

    probability = Column(SQLEnum(Probability), default=Probability.MEDIUM)
    impact = Column(SQLEnum(Impact), default=Impact.MEDIUM)
    status = Column(SQLEnum(RiskStatus), default=RiskStatus.ACTIVE)

    mitigation = Column(String(1000))  # Меры митигации
    owner = Column(String(255))  # Ответственный

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
