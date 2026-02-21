from sqlalchemy import Column, Integer, String, Float, DateTime, Enum as SQLEnum, ForeignKey
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


class EnterpriseCategory(str, enum.Enum):
    A = "A"  # Быстрые победы
    B = "B"  # Рабочие кейсы
    V = "V"  # Длинные проекты
    G = "G"  # Заморозка


class SalesStatus(str, enum.Enum):
    PLANNED = "planned"            # В планах
    CONTACT = "contact"            # Первый контакт
    NEGOTIATION = "negotiation"    # Переговоры
    CONTRACT = "contract"          # Договор
    LAUNCHED = "launched"          # Запущено


class Enterprise(Base):
    __tablename__ = "enterprises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100))
    employee_count = Column(Integer)
    bank_penetration = Column(Float, default=0.0)  # % зарплатного проекта
    status = Column(SQLEnum(EnterpriseStatus), default=EnterpriseStatus.PROSPECT)

    # Pipeline fields
    category = Column(SQLEnum(EnterpriseCategory), default=EnterpriseCategory.V)
    score = Column(Integer, default=0)  # Скоринг-балл
    sales_status = Column(SQLEnum(SalesStatus), default=SalesStatus.PLANNED)

    inn = Column(String(12))  # ИНН предприятия (10 или 12 цифр)
    holding = Column(String(255))  # Холдинг/группа компаний
    locations = Column(String(1000))  # JSON string of locations
    contact_person = Column(String(255))
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    notes = Column(String(2000))
    manager = Column(String(255))  # Ответственный менеджер

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Owner (for permission checks)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])

    # Relationships
    kpp_contracts = relationship("KPPContract", back_populates="enterprise")
    interactions = relationship("Interaction", back_populates="enterprise", cascade="all, delete-orphan", order_by="desc(Interaction.date)")
