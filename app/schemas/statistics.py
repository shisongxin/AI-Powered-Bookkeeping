# app/schemas/statistics.py

from pydantic import BaseModel
from typing import List, Optional


class MonthlySummary(BaseModel):
    year: int
    month: int
    income: float
    expense: float
    net: float
    transaction_count: int


class CategoryBreakdownItem(BaseModel):
    category: str
    amount: float
    count: int
    percentage: float


class CategoryBreakdown(BaseModel):
    items: List[CategoryBreakdownItem]
    total: float  # 所有分类金额合计


class TrendItem(BaseModel):
    period: str       # "2026-05" / "2026-05-15" / "2026-W20"
    income: float
    expense: float
    net: float


class TrendResponse(BaseModel):
    granularity: str
    items: List[TrendItem]
