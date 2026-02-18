from sqlalchemy import Column, Integer, String, Float, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class EnterpriseStatus(str, enum.Enum):
    PROSPECT = "prospect"
    NEGOTIATION = "negotiation"
    PILOT = "pilot"
    ACTIVE = "active"
    INACTIVE = "inactive"


class Enterprise(Base):
    __tablename__ = "enterprises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100))
    employee_count = Column(Integer)
    bank_penetration = Column(Float, default=0.0)  # % зарплатного проекта
    status = Column(SQLEnum(EnterpriseStatus), default=EnterpriseStatus.PROSPECT)
    locations = Column(String(1000))  # JSON string of locations
    contact_person = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    notes = Column(String(2000))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    kpp_contracts = relationship("KPPContract", back_populates="enterprise")
