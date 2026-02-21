from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.enterprise import EnterpriseStatus, EnterpriseCategory, SalesStatus
from app.models.interaction import InteractionType


class InteractionBase(BaseModel):
    interaction_type: Optional[InteractionType] = InteractionType.OTHER
    date: Optional[datetime] = None
    description: str
    result: Optional[str] = None
    created_by: Optional[str] = None


class InteractionCreate(InteractionBase):
    pass


class InteractionResponse(InteractionBase):
    id: int
    enterprise_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EnterpriseBase(BaseModel):
    name: str
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    bank_penetration: Optional[float] = 0.0
    status: Optional[EnterpriseStatus] = EnterpriseStatus.PROSPECT
    category: Optional[EnterpriseCategory] = EnterpriseCategory.V
    score: Optional[int] = 0
    sales_status: Optional[SalesStatus] = SalesStatus.CONTACT
    inn: Optional[str] = None
    holding: Optional[str] = None
    locations: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    manager: Optional[str] = None


class EnterpriseCreate(EnterpriseBase):
    pass


class EnterpriseUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    bank_penetration: Optional[float] = None
    status: Optional[EnterpriseStatus] = None
    category: Optional[EnterpriseCategory] = None
    score: Optional[int] = None
    sales_status: Optional[SalesStatus] = None
    inn: Optional[str] = None
    holding: Optional[str] = None
    locations: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    manager: Optional[str] = None


class EnterpriseResponse(EnterpriseBase):
    id: int
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    interactions: Optional[List[InteractionResponse]] = []

    class Config:
        from_attributes = True
