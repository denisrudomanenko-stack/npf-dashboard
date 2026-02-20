from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class InteractionType(str, enum.Enum):
    CALL = "call"              # Звонок
    MEETING = "meeting"        # Встреча
    EMAIL = "email"            # Письмо
    PRESENTATION = "presentation"  # Презентация
    CONTRACT = "contract"      # Работа с договором
    OTHER = "other"            # Прочее


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    enterprise_id = Column(Integer, ForeignKey("enterprises.id", ondelete="CASCADE"), nullable=False)

    interaction_type = Column(SQLEnum(InteractionType), default=InteractionType.OTHER)
    date = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(Text, nullable=False)
    result = Column(String(500))  # Результат/итог

    created_by = Column(String(255))  # Кто создал запись
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    enterprise = relationship("Enterprise", back_populates="interactions")
