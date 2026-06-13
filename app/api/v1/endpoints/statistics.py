# app/api/v1/endpoints/statistics.py

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
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
    current_user: Optional[User] = Depends(get_current_active_user),
):
    """月度收支汇总（返回当前用户数据）"""
    svc = StatisticsService(db)
    user_id = current_user.id if current_user else None
    return svc.monthly_summary(year, month, user_id=user_id)


@router.get("/by-category", response_model=list[CategoryBreakdownItem])
def category_breakdown(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    direction: str = Query("支出", pattern="^(支出|收入)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_active_user),
):
    """按分类统计（饼图数据）"""
    svc = StatisticsService(db)
    user_id = current_user.id if current_user else None
    return svc.category_breakdown(start_date, end_date, direction, user_id=user_id)


@router.get("/trend", response_model=list[TrendItem])
def trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    granularity: str = Query("monthly", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_active_user),
):
    """消费趋势（daily/weekly/monthly）"""
    svc = StatisticsService(db)
    user_id = current_user.id if current_user else None
    return svc.trend(start_date, end_date, granularity, user_id=user_id)
