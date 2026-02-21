from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ContributionScheme(str, enum.Enum):
    EMPLOYER_ONLY = "employer_only"  # Только работодатель
    EMPLOYEE_ONLY = "employee_only"  # Только работник
    MATCHING = "matching"  # Паритетная (50/50)
    CUSTOM = "custom"  # Другая пропорция


class KPPStatus(str, enum.Enum):
    DRAFT = "draft"
    NEGOTIATION = "negotiation"
    SIGNED = "signed"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class KPPContract(Base):
    __tablename__ = "kpp_contracts"

    id = Column(Integer, primary_key=True, index=True)
    enterprise_id = Column(Integer, ForeignKey("enterprises.id"), nullable=False)

    contract_number = Column(String(50), unique=True)
    contract_date = Column(Date)
    start_date = Column(Date)

    participants_count = Column(Integer, default=0)  # Фактическое количество участников
    target_participants = Column(Integer)  # Планируемое количество
    collections = Column(Float, default=0.0)  # Сумма взносов по договору (млн руб)

    contribution_scheme = Column(SQLEnum(ContributionScheme), default=ContributionScheme.MATCHING)
    employer_contribution_pct = Column(Float, default=0.0)
    employee_contribution_pct = Column(Float, default=0.0)

    status = Column(SQLEnum(KPPStatus), default=KPPStatus.DRAFT)
    notes = Column(String(2000))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    enterprise = relationship("Enterprise", back_populates="kpp_contracts")
