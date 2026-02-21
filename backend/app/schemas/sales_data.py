from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class PeriodType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TrackType(str, Enum):
    BANK = "bank"  # КПП в Банке (Трек 1)
    EXTERNAL = "external"  # Внешние продажи (Трек 2)
    ZK = "zk"  # Продажи в ЗК (зарплатные клиенты)


class SalesDataBase(BaseModel):
    track: TrackType = TrackType.BANK
    date: date
    period_type: PeriodType = PeriodType.MONTHLY
    collections: float = Field(default=0, description="Сборы (млн руб)")
    participants: int = Field(default=0, description="Участники")

    # Track 1 (bank) - КПП в Банке
    penetration: float = Field(default=0, description="% проникновения (только для bank)")
    employee_contributions: float = Field(default=0, description="Взносы работников, млн руб (только для bank)")
    bank_contributions: float = Field(default=0, description="Взносы Банка, млн руб (только для bank)")

    # Track 2 (external) - Внешние продажи
    enterprises: int = Field(default=0, description="Предприятий в работе (только для external)")
    enterprises_total: int = Field(default=0, description="Всего предприятий (только для external)")
    contracts: int = Field(default=0, description="Договоры (только для external)")

    # Track 3 (zk) - Продажи в ЗК
    dds_count: int = Field(default=0, description="Количество ДДС (только для zk)")
    dds_collections: float = Field(default=0, description="Сумма взносов ДДС, млн руб (только для zk)")

    notes: Optional[str] = None


class SalesDataCreate(SalesDataBase):
    pass


class SalesDataUpdate(BaseModel):
    track: Optional[TrackType] = None
    date: Optional[date] = None
    period_type: Optional[PeriodType] = None
    collections: Optional[float] = None
    participants: Optional[int] = None
    penetration: Optional[float] = None
    employee_contributions: Optional[float] = None
    bank_contributions: Optional[float] = None
    enterprises: Optional[int] = None
    enterprises_total: Optional[int] = None
    contracts: Optional[int] = None
    dds_count: Optional[int] = None
    dds_collections: Optional[float] = None
    notes: Optional[str] = None


class SalesDataResponse(SalesDataBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SalesDataAggregated(BaseModel):
    period: str  # "2026-01", "2026-Q1", etc.
    track: str
    collections: float
    participants: int
    penetration: float
    employee_contributions: float
    bank_contributions: float
    enterprises: int
    contracts: int
    dds_count: int
    dds_collections: float


class SalesDataBulkImport(BaseModel):
    data: List[SalesDataCreate]
