from sqlalchemy import Column, Integer, Float, Date, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


class SalesData(Base):
    """Оперативные данные по продажам с историей.

    Разделены на три трека:
    - bank: КПП в Банке (сотрудники банка)
    - external: Внешние продажи (корпоративные клиенты)
    - zk: Продажи в ЗК (зарплатные клиенты, ДДС)
    """
    __tablename__ = "sales_data"

    id = Column(Integer, primary_key=True, index=True)
    track = Column(String(20), nullable=False, index=True, default="bank")  # 'bank', 'external', 'zk'
    date = Column(Date, nullable=False, index=True)
    period_type = Column(String(20), default="monthly")  # 'daily', 'weekly', 'monthly'

    # Общие показатели
    collections = Column(Float, default=0)  # Сборы (млн руб)
    participants = Column(Integer, default=0)  # Участники

    # Специфичные для Трек 1 (bank) - КПП в Банке
    penetration = Column(Float, default=0)  # % проникновения ЗП-проекта
    employee_contributions = Column(Float, default=0)  # Взносы работников (млн руб)
    bank_contributions = Column(Float, default=0)  # Взносы Банка (млн руб)

    # Специфичные для Трек 2 (external) - Внешние продажи
    enterprises = Column(Integer, default=0)  # Количество предприятий в работе
    enterprises_total = Column(Integer, default=0)  # Общее количество предприятий
    contracts = Column(Integer, default=0)  # Договоры

    # Специфичные для Трек 3 (zk) - Продажи в ЗК
    dds_count = Column(Integer, default=0)  # Количество ДДС (договоров долгосрочных сбережений)
    dds_collections = Column(Float, default=0)  # Сумма взносов ДДС (млн руб)

    notes = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
