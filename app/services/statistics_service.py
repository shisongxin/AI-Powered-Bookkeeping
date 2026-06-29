# app/services/statistics_service.py

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case
from app.models.bill import Bill
from app.schemas.statistics import (
    MonthlySummary,
    CategoryBreakdownItem,
    TrendItem,
)
from datetime import date, datetime, timedelta
from typing import List, Optional


class StatisticsService:
    def __init__(self, db: Session):
        self.db = db

    def monthly_summary(self, year: int, month: int, user_id: Optional[int] = None) -> MonthlySummary:
        q = self.db.query(Bill).filter(
            func.extract("year", Bill.transaction_date) == year,
            func.extract("month", Bill.transaction_date) == month,
        )
        if user_id is not None:
            q = q.filter(Bill.user_id == user_id)
        bills = q.all()

        # 使用 direction 字段判断收支（amount 始终为正值）
        income = sum(abs(b.amount) or 0 for b in bills if b.direction == "收入")
        expense = sum(abs(b.amount) or 0 for b in bills if b.direction == "支出")
        return MonthlySummary(
            year=year,
            month=month,
            income=round(income, 2),
            expense=round(expense, 2),
            net=round(income - expense, 2),
            transaction_count=len(bills),
        )

    def category_breakdown(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        direction: str = "支出",
        user_id: Optional[int] = None,
    ) -> List[CategoryBreakdownItem]:
        q = self.db.query(
            Bill.category,
            func.sum(func.abs(Bill.amount)).label("total"),
            func.count(Bill.id).label("cnt"),
        )
        # 使用 direction 字段判断收支
        q = q.filter(Bill.direction == direction)

        if user_id is not None:
            q = q.filter(Bill.user_id == user_id)

        if start_date:
            q = q.filter(Bill.transaction_date >= start_date)
        if end_date:
            q = q.filter(Bill.transaction_date < end_date + timedelta(days=1))

        rows = q.group_by(Bill.category).order_by(func.abs(func.sum(Bill.amount)).desc()).all()

        grand_total = sum(r.total or 0 for r in rows)
        result = []
        for cat, total, cnt in rows:
            pct = round(total / grand_total * 100, 1) if grand_total > 0 else 0
            result.append(CategoryBreakdownItem(
                category=cat or "未分类",
                amount=round(total, 2),
                count=cnt,
                percentage=pct,
            ))
        return result

    def trend(
        self,
        start_date: date,
        end_date: date,
        granularity: str = "monthly",
        user_id: Optional[int] = None,
    ) -> List[TrendItem]:
        q = self.db.query(Bill).filter(
            Bill.transaction_date >= start_date,
            Bill.transaction_date < end_date + timedelta(days=1),
        )
        if user_id is not None:
            q = q.filter(Bill.user_id == user_id)

        bills = q.all()

        buckets: dict[str, dict[str, float]] = {}
        for b in bills:
            if b.transaction_date is None:
                continue
            dt = b.transaction_date
            if granularity == "daily":
                key = dt.strftime("%Y-%m-%d")
            elif granularity == "weekly":
                key = dt.strftime("%Y-W%W")
            else:  # monthly
                key = dt.strftime("%Y-%m")

            if key not in buckets:
                buckets[key] = {"income": 0.0, "expense": 0.0}
            # 使用 direction 字段判断收支
            if b.direction == "收入":
                buckets[key]["income"] += abs(b.amount) or 0
            elif b.direction == "支出":
                buckets[key]["expense"] += abs(b.amount) or 0
            elif b.amount and b.amount > 0:
                # 对于没有 direction 的数据，使用 amount 符号
                buckets[key]["income"] += abs(b.amount)
            elif b.amount and b.amount < 0:
                buckets[key]["expense"] += abs(b.amount)

        result = []
        for key in sorted(buckets.keys()):
            v = buckets[key]
            result.append(TrendItem(
                period=key,
                income=round(v["income"], 2),
                expense=round(v["expense"], 2),
                net=round(v["income"] - v["expense"], 2),
            ))
        return result
