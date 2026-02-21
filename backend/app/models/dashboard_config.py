from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class DashboardConfig(Base):
    """Конфигурация дашборда (целевые параметры, формулы, правила скоринга)."""
    __tablename__ = "dashboard_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text)  # JSON string
    description = Column(String(500))
    category = Column(String(50))  # 'kpi', 'scoring', 'risks', 'formulas', 'data_sources'

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
