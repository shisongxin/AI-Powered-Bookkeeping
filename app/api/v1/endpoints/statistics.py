# app/api/v1/endpoints/statistics.py

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.core.database import get_db
from app.services.statistics_service import StatisticsService
from app.schemas.statistics import (
    MonthlySummary,
    CategoryBreakdownItem,
    TrendItem,
)

router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("/monthly-summary", response_model=MonthlySummary)
def monthly_summary(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """月度收支汇总"""
    svc = StatisticsService(db)
    return svc.monthly_summary(year, month)


@router.get("/by-category", response_model=list[CategoryBreakdownItem])
def category_breakdown(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    direction: str = Query("支出", pattern="^(支出|收入)$"),
    db: Session = Depends(get_db),
):
    """按分类统计（饼图数据）"""
    svc = StatisticsService(db)
    return svc.category_breakdown(start_date, end_date, direction)


@router.get("/trend", response_model=list[TrendItem])
def trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    granularity: str = Query("monthly", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
):
    """消费趋势（daily/weekly/monthly）"""
    svc = StatisticsService(db)
    return svc.trend(start_date, end_date, granularity)
