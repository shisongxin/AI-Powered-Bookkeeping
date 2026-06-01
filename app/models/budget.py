# app/models/budget.py
"""月度预算模型 — 按分类设置预算，与统计服务配合实现计划 vs 实际对比"""

from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint
from datetime import datetime

from app.core.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, comment="预算年份")
    month = Column(Integer, nullable=False, comment="预算月份 (1-12)")
    category = Column(String(50), nullable=False, comment="分类名称（如\"餐饮\"、\"交通\"）")
    amount = Column(Float, nullable=False, comment="预算金额（正数）")
    note = Column(String(200), nullable=True, comment="备注说明")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint("year", "month", "category", name="uq_budget_ymc"),
    )
