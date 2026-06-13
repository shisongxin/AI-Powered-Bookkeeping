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

    def set_budget(self, data: BudgetCreate, user_id: int) -> Budget:
        """设置/覆盖预算（同一年月+分类唯一约束下 upsert）"""
        # 先查找同一年月+分类的记录（不考虑 user_id）
        existing = (
            self.db.query(Budget)
            .filter(
                Budget.year == data.year,
                Budget.month == data.month,
                Budget.category == data.category,
            )
            .first()
        )
        if existing:
            # 如果记录存在但 user_id 为 NULL，更新 user_id
            if existing.user_id is None:
                existing.user_id = user_id
            existing.amount = data.amount
            if data.note is not None:
                existing.note = data.note
            existing.updated_at = datetime.now()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        budget = Budget(
            year=data.year, month=data.month, category=data.category,
            amount=data.amount, note=data.note, user_id=user_id,
        )
        self.db.add(budget)
        self.db.commit()
        self.db.refresh(budget)
        return budget

    def get_budget_by_id(self, budget_id: int) -> Optional[Budget]:
        """根据 ID 获取单个预算"""
        return self.db.query(Budget).filter(Budget.id == budget_id).first()

    def get_budgets(self, year: int, month: int, user_id: Optional[int] = None) -> list[Budget]:
        """获取指定年月的所有预算

        Args:
            user_id: 用户 ID，为 None 时返回所有预算（向后兼容）
        """
        q = self.db.query(Budget).filter(Budget.year == year, Budget.month == month)
        if user_id is not None:
            q = q.filter(Budget.user_id == user_id)
        return q.order_by(Budget.category).all()

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

    def vs_actual(self, year: int, month: int, user_id: Optional[int] = None) -> BudgetVsActualResponse:
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
            user_id=user_id,
        )
        actual_map = {item.category: item.amount for item in actual_items}

        # 获取该月预算
        budgets = self.get_budgets(year, month, user_id=user_id)
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

    # ---------- 自动生成预算 ----------

    def auto_generate(self, year: int, month: int, user_id: int) -> list[Budget]:
        """基于上月实际消费数据自动生成当月预算（上浮 10% 缓冲）。
        若当月已有预算则跳过不覆盖；若上月无消费数据则返回空列表。
        """
        from datetime import date
        import calendar

        # 计算上月
        prev_month = month - 1
        prev_year = year
        if prev_month <= 0:
            prev_month += 12
            prev_year -= 1

        # 获取上月支出分类数据
        stats_svc = StatisticsService(self.db)
        last_day = calendar.monthrange(prev_year, prev_month)[1]
        breakdown = stats_svc.category_breakdown(
            start_date=date(prev_year, prev_month, 1),
            end_date=date(prev_year, prev_month, last_day),
            direction="支出",
            user_id=user_id,
        )

        if not breakdown:
            logger.info(f"上月 ({prev_year}-{prev_month:02d}) 无消费数据，无法自动生成预算")
            return []

        # 获取当月已有预算（不覆盖）
        existing = {b.category for b in self.get_budgets(year, month, user_id=user_id)}
        created: list[Budget] = []

        for item in breakdown:
            if item.category in existing:
                continue  # 已有预算，跳过

            suggested = round(item.amount * 1.10, 2)  # 上浮 10% 缓冲
            budget = Budget(
                year=year, month=month,
                category=item.category,
                amount=suggested,
                user_id=user_id,
                note=f"基于上月 ({prev_year}-{prev_month:02d}) 消费 {item.amount:.0f} 元自动生成",
            )
            self.db.add(budget)
            created.append(budget)
            existing.add(item.category)

        if created:
            self.db.commit()
            for b in created:
                self.db.refresh(b)
            logger.info(f"自动生成 {len(created)} 条预算 ({year}-{month:02d})")

        return created

    # ---------- AI 预算建议 ----------

    def suggest_budget(self, year: int, month: int,
                       client: Optional[OpenAI] = None,
                       user_id: Optional[int] = None) -> list[BudgetSuggestionItem]:
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
                user_id=user_id,
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
