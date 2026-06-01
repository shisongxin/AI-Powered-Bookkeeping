# app/services/budget_service.py
"""月度预算服务 — CRUD + 预算 vs 实际对比 + AI 预算建议"""

import json
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from openai import OpenAI

from app.config import settings
from app.models.budget import Budget
from app.services.statistics_service import StatisticsService
from app.schemas.budget import (
    BudgetCreate, BudgetUpdate, BudgetResponse,
    BudgetVsActualItem, BudgetVsActualResponse, BudgetSuggestionItem,
)

logger = logging.getLogger(__name__)


class BudgetService:
    """月度预算业务逻辑"""

    def __init__(self, db: Session):
        self.db = db

    # ---------- CRUD ----------

    def set_budget(self, data: BudgetCreate) -> Budget:
        """设置/覆盖预算（同一年月+分类唯一约束下 upsert）"""
        existing = (
            self.db.query(Budget)
            .filter(Budget.year == data.year, Budget.month == data.month, Budget.category == data.category)
            .first()
        )
        if existing:
            existing.amount = data.amount
            if data.note is not None:
                existing.note = data.note
            existing.updated_at = datetime.now()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        budget = Budget(year=data.year, month=data.month, category=data.category,
                        amount=data.amount, note=data.note)
        self.db.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def get_budgets(self, year: int, month: int) -> list[Budget]:
        """获取指定年月的所有预算"""
        return (
            self.db.query(Budget)
            .filter(Budget.year == year, Budget.month == month)
            .order_by(Budget.category)
            .all()
        )

    def update_budget(self, budget_id: int, data: BudgetUpdate) -> Budget | None:
        """部分更新预算"""
        budget = self.db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            return None
        if data.amount is not None:
            budget.amount = data.amount
        if data.note is not None:
            budget.note = data.note
        budget.updated_at = datetime.now()
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def delete_budget(self, budget_id: int) -> bool:
        """删除预算"""
        budget = self.db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            return False
        self.db.delete(budget)
        self.db.commit()
        return True

    # ---------- 预算 vs 实际 ----------

    def vs_actual(self, year: int, month: int) -> BudgetVsActualResponse:
        """对比预算与实际支出，返回每个分类的消耗状态"""
        stats_svc = StatisticsService(self.db)
        # 获取该月实际支出分布
        from datetime import date
        import calendar

        last_day = calendar.monthrange(year, month)[1]
        actual_items = stats_svc.category_breakdown(
            start_date=date(year, month, 1),
            end_date=date(year, month, last_day),
            direction="支出",
        )
        actual_map = {item.category: item.amount for item in actual_items}

        # 获取该月预算
        budgets = self.get_budgets(year, month)
        budget_map = {b.category: b.amount for b in budgets}

        # 合并所有分类
        all_categories = set(budget_map.keys()) | set(actual_map.keys())
        items: list[BudgetVsActualItem] = []
        total_budget = 0.0
        total_actual = 0.0

        for cat in sorted(all_categories):
            budget = budget_map.get(cat, 0.0)
            actual = actual_map.get(cat, 0.0)
            remaining = budget - actual
            pct = (actual / budget * 100) if budget > 0 else (100 if actual > 0 else 0)

            if budget == 0:
                status = "无预算"
            elif pct >= 100:
                status = "已超支"
            elif pct >= 80:
                status = "接近上限"
            else:
                status = "正常"

            items.append(BudgetVsActualItem(
                category=cat,
                budget=round(budget, 2),
                actual=round(actual, 2),
                remaining=round(remaining, 2),
                percentage=round(pct, 1),
                status=status,
            ))
            total_budget += budget
            total_actual += actual

        return BudgetVsActualResponse(
            year=year, month=month, items=items,
            total_budget=round(total_budget, 2),
            total_actual=round(total_actual, 2),
            total_remaining=round(total_budget - total_actual, 2),
        )

    # ---------- AI 预算建议 ----------

    def suggest_budget(self, year: int, month: int,
                       client: Optional[OpenAI] = None) -> list[BudgetSuggestionItem]:
        """基于近 3 个月历史消费数据，由 LLM 生成下月预算建议。
        client 参数由 ChatService 传入以复用已有连接；为空时自动创建。
        """
        stats_svc = StatisticsService(self.db)
        from datetime import date
        import calendar

        # 收集近 3 个月的分类消费数据
        history: dict[str, list[float]] = {}
        for offset in range(3, 0, -1):
            m = month - offset
            y = year
            if m <= 0:
                m += 12
                y -= 1
            last_day = calendar.monthrange(y, m)[1]
            breakdown = stats_svc.category_breakdown(
                start_date=date(y, m, 1),
                end_date=date(y, m, last_day),
                direction="支出",
            )
            for item in breakdown:
                history.setdefault(item.category, []).append(item.amount)

        # 汇总为 LLM 输入
        avg_data = {}
        for cat, amounts in history.items():
            avg_data[cat] = round(sum(amounts) / len(amounts), 2)

        # 优先使用外部传入的 client（ChatService 共享连接），否则自建
        llm = client or OpenAI(
            api_key=settings.OPENAI_API_KEY or "sk-placeholder",
            base_url=settings.OPENAI_BASE_URL,
        )
        prompt = f"""基于以下近3月各分类的月均消费数据，为 {year}年{month}月生成预算建议。
对每个分类给出建议预算金额（比月均高5-10%作为缓冲）和简短理由。

月均消费: {json.dumps(avg_data, ensure_ascii=False)}

返回纯 JSON 数组（不要 markdown 包裹）:
[{{"category":"餐饮","suggested_amount":3000.0,"reason":"月均2850，预留5%空间"}}, ...]"""

        try:
            resp = llm.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=512,
                temperature=0.3,
            )
            text = resp.choices[0].message.content or ""
            # strip markdown fences
            if text.strip().startswith("```"):
                lines = text.strip().split("\n")
                text = "\n".join(lines[1:-1]) if len(lines) > 2 else text

            suggestions = json.loads(text)
            return [
                BudgetSuggestionItem(
                    category=s["category"],
                    suggested_amount=s["suggested_amount"],
                    reason=s.get("reason", ""),
                )
                for s in suggestions
            ]
        except Exception as e:
            logger.warning(f"AI 预算建议生成失败: {e}")
            # 回退：简单基于月均 + 5%
            return [
                BudgetSuggestionItem(
                    category=cat,
                    suggested_amount=round(avg * 1.05, 2),
                    reason=f"基于近3月月均 {avg} 元，上浮5%",
                )
                for cat, avg in avg_data.items()
            ]
