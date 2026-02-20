from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ColumnConfig(BaseModel):
    id: str
    label: str
    visible: bool = True
    sortable: bool = True


class TableSettings(BaseModel):
    columns: List[ColumnConfig]
    sortBy: Optional[str] = None
    sortOrder: str = "asc"


class TableConfigCreate(BaseModel):
    config: TableSettings


class TableConfigResponse(BaseModel):
    id: int
    table_name: str
    config: TableSettings
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
