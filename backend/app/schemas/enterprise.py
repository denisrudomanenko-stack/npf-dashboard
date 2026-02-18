from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enterprise import EnterpriseStatus


class EnterpriseBase(BaseModel):
    name: str
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    bank_penetration: Optional[float] = 0.0
    status: Optional[EnterpriseStatus] = EnterpriseStatus.PROSPECT
    locations: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class EnterpriseCreate(EnterpriseBase):
    pass


class EnterpriseUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    bank_penetration: Optional[float] = None
    status: Optional[EnterpriseStatus] = None
    locations: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class EnterpriseResponse(EnterpriseBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
