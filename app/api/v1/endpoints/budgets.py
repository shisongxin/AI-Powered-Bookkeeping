# app/api/v1/endpoints/budgets.py
"""月度预算端点 — 设置预算、查询预算、预算 vs 实际对比、AI 建议"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.services.budget_service import BudgetService
from app.schemas.budget import (
    BudgetCreate, BudgetUpdate, BudgetResponse,
    BudgetVsActualResponse, BudgetSuggestionItem,
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.post("/", response_model=BudgetResponse, status_code=201)
def set_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    """创建或更新预算（同一年月+分类自动覆盖）"""
    svc = BudgetService(db)
    return svc.set_budget(data)


@router.get("/", response_model=list[BudgetResponse])
def get_budgets(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """获取指定年月的所有预算"""
    svc = BudgetService(db)
    return svc.get_budgets(year, month)


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(budget_id: int, data: BudgetUpdate, db: Session = Depends(get_db)):
    """部分更新预算"""
    svc = BudgetService(db)
    result = svc.update_budget(budget_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="预算记录不存在")
    return result


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    """删除预算"""
    svc = BudgetService(db)
    ok = svc.delete_budget(budget_id)
    if not ok:
        raise HTTPException(status_code=404, detail="预算记录不存在")
    return {"detail": "已删除"}


@router.get("/vs-actual", response_model=BudgetVsActualResponse)
def budget_vs_actual(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """预算 vs 实际支出对比，返回每个分类的消耗状态"""
    svc = BudgetService(db)
    return svc.vs_actual(year, month)


@router.get("/suggest", response_model=list[BudgetSuggestionItem])
def suggest_budget(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """AI 基于近 3 月消费数据生成预算建议"""
    svc = BudgetService(db)
    return svc.suggest_budget(year, month)


@router.post("/auto-generate", response_model=list[BudgetResponse])
def auto_generate_budgets(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """基于上月实际消费数据自动生成当月预算（上浮 10% 缓冲）。
    若当月已有预算则跳过不覆盖；若上月无消费数据则返回空列表。"""
    svc = BudgetService(db)
    return svc.auto_generate(year, month)
