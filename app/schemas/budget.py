# app/schemas/budget.py
"""月度预算相关 Pydantic 模型"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BudgetCreate(BaseModel):
    """创建/更新预算（同一年月+分类自动覆盖）"""
    year: int = Field(..., ge=2000, le=2100, description="年份")
    month: int = Field(..., ge=1, le=12, description="月份")
    category: str = Field(..., min_length=1, max_length=50, description="分类名称")
    amount: float = Field(..., gt=0, description="预算金额（正数）")
    note: Optional[str] = Field(None, max_length=200, description="备注")


class BudgetUpdate(BaseModel):
    """更新预算（部分字段）"""
    amount: Optional[float] = Field(None, gt=0)
    note: Optional[str] = Field(None, max_length=200)


class BudgetResponse(BaseModel):
    """预算记录响应"""
    id: int
    year: int
    month: int
    category: str
    amount: float
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BudgetVsActualItem(BaseModel):
    """单个分类的预算 vs 实际对比"""
    category: str
    budget: float = Field(..., description="预算金额")
    actual: float = Field(..., description="实际支出")
    remaining: float = Field(..., description="剩余: 正数=未超，负数=超支")
    percentage: float = Field(..., description="已使用百分比 (0-100+)")
    status: str = Field(..., description="状态: 正常/接近上限/已超支/无预算")


class BudgetVsActualResponse(BaseModel):
    """预算 vs 实际完整对比"""
    year: int
    month: int
    items: List[BudgetVsActualItem]
    total_budget: float
    total_actual: float
    total_remaining: float


class BudgetSuggestionItem(BaseModel):
    """AI 生成的预算建议单条"""
    category: str
    suggested_amount: float
    reason: str
