from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ConfigCategory(str, Enum):
    KPI = "kpi"
    SCORING = "scoring"
    RISKS = "risks"
    FORMULAS = "formulas"
    DATA_SOURCES = "data_sources"


class DashboardConfigBase(BaseModel):
    key: str
    value: Dict[str, Any]
    description: Optional[str] = None
    category: ConfigCategory


class DashboardConfigCreate(DashboardConfigBase):
    pass


class DashboardConfigUpdate(BaseModel):
    value: Dict[str, Any]
    description: Optional[str] = None


class DashboardConfigResponse(BaseModel):
    id: int
    key: str
    value: Dict[str, Any]
    description: Optional[str] = None
    category: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Predefined config types
class KPITargets(BaseModel):
    collections_target: float = 3.0  # млрд руб
    participants_target: int = 50000
    enterprises_target: int = 50
    track1_penetration_target: float = 17.0  # %
    track1_penetration_current: float = 9.0  # %


class ScoringRule(BaseModel):
    weight: float
    thresholds: Optional[list] = None
    priority: Optional[list] = None


class ScoringRules(BaseModel):
    employee_count: ScoringRule
    bank_penetration: ScoringRule
    industry: ScoringRule
    status: ScoringRule


class CategoryRule(BaseModel):
    min_score: int
    label: str


class CategoryRules(BaseModel):
    A: CategoryRule
    B: CategoryRule
    V: CategoryRule
    G: CategoryRule


class RiskMatrixConfig(BaseModel):
    probability_levels: list = ["low", "medium", "high"]
    impact_levels: list = ["low", "medium", "high", "critical"]
    color_scheme: Dict[str, str] = {
        "low": "#4caf50",
        "medium": "#ff9800",
        "high": "#f44336"
    }


class FormulasConfig(BaseModel):
    penetration: str = "participants / total_employees * 100"
    progress: str = "completed_milestones / total_milestones * 100"
    efficiency: str = "collections / enterprises_launched"
