# tests/test_budgets.py
"""月度预算测试 — BudgetService + API 端点 + vs-actual + AI 建议"""

import json
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from app.models.budget import Budget
from app.models.bill import Bill
from app.schemas.budget import BudgetCreate, BudgetUpdate


# ---------- 种子数据 ----------

def seed_budget_data(db):
    """准备测试数据：分类 + 账单 + 预算"""
    # 添加一些用于 vs-actual 对比的账单
    bills = [
        Bill(amount=-300.0, category="餐饮", direction="支出",
             transaction_date=datetime(2026, 6, 5, 12, 0)),
        Bill(amount=-150.0, category="餐饮", direction="支出",
             transaction_date=datetime(2026, 6, 15, 19, 0)),
        Bill(amount=-100.0, category="交通", direction="支出",
             transaction_date=datetime(2026, 6, 10, 9, 0)),
    ]
    for b in bills:
        db.add(b)
    db.commit()


# ========== 1. BudgetService CRUD 测试 ==========

class TestBudgetService:
    def test_set_budget_new(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        budget = svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=1000.0))
        assert budget.id is not None
        assert budget.amount == 1000.0
        assert budget.category == "餐饮"

    def test_set_budget_upsert(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=800.0))
        # 再次设置同分类同月份——应覆盖
        svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=1200.0))
        budgets = svc.get_budgets(2026, 6)
        assert len(budgets) == 1
        assert budgets[0].amount == 1200.0

    def test_get_budgets(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=1000.0))
        svc.set_budget(BudgetCreate(year=2026, month=6, category="交通", amount=500.0))
        result = svc.get_budgets(2026, 6)
        assert len(result) == 2

    def test_get_budgets_empty_month(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        result = svc.get_budgets(2026, 12)
        assert result == []

    def test_update_budget(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        b = svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=1000.0))
        updated = svc.update_budget(b.id, BudgetUpdate(amount=1500.0))
        assert updated is not None
        assert updated.amount == 1500.0

    def test_update_budget_not_found(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        assert svc.update_budget(99999, BudgetUpdate(amount=100.0)) is None

    def test_delete_budget(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        b = svc.set_budget(BudgetCreate(year=2026, month=6, category="娱乐", amount=500.0))
        assert svc.delete_budget(b.id) is True
        assert len(svc.get_budgets(2026, 6)) == 0

    def test_delete_budget_not_found(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        assert svc.delete_budget(99999) is False


# ========== 2. 预算 vs 实际测试 ==========

class TestVsActual:
    def test_vs_actual_basic(self, db):
        seed_budget_data(db)
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=600.0))  # 450/600=75% → 正常
        svc.set_budget(BudgetCreate(year=2026, month=6, category="交通", amount=200.0))  # 100/200=50%

        result = svc.vs_actual(2026, 6)
        assert result.year == 2026
        assert result.month == 6
        assert result.total_budget == 800.0
        assert result.total_actual == 550.0  # 300+150+100
        assert result.total_remaining == 250.0

        items = {i.category: i for i in result.items}
        assert items["餐饮"].actual == 450.0
        assert items["餐饮"].budget == 600.0
        assert items["餐饮"].remaining == 150.0
        assert items["餐饮"].status == "正常"

        assert items["交通"].actual == 100.0
        assert items["交通"].budget == 200.0
        assert items["交通"].status == "正常"

    def test_vs_actual_over_budget(self, db):
        seed_budget_data(db)
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=200.0))  # 实际450

        result = svc.vs_actual(2026, 6)
        items = {i.category: i for i in result.items}
        assert items["餐饮"].status == "已超支"
        assert items["餐饮"].remaining < 0

    def test_vs_actual_near_limit(self, db):
        seed_budget_data(db)
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=500.0))  # 实际450, 90%

        result = svc.vs_actual(2026, 6)
        items = {i.category: i for i in result.items}
        assert items["餐饮"].status == "接近上限"
        assert 80 <= items["餐饮"].percentage < 100

    def test_vs_actual_no_budget_no_actual(self, db):
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)
        result = svc.vs_actual(2026, 12)
        assert result.total_budget == 0
        assert result.total_actual == 0


# ========== 3. AI 预算建议测试 ==========

class TestBudgetSuggestion:
    def test_suggest_with_data(self, db):
        seed_budget_data(db)
        from app.services.budget_service import BudgetService
        svc = BudgetService(db)

        # Mock LLM 返回
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message.content = json.dumps([
            {"category": "餐饮", "suggested_amount": 500.0, "reason": "月均450"},
            {"category": "交通", "suggested_amount": 110.0, "reason": "月均100"},
        ], ensure_ascii=False)

        with patch.object(svc, 'suggest_budget') as mock_suggest:
            from app.schemas.budget import BudgetSuggestionItem
            mock_suggest.return_value = [
                BudgetSuggestionItem(category="餐饮", suggested_amount=500.0, reason="月均450"),
                BudgetSuggestionItem(category="交通", suggested_amount=110.0, reason="月均100"),
            ]
            suggestions = svc.suggest_budget(2026, 7)
            assert len(suggestions) == 2
            assert suggestions[0].category == "餐饮"
            assert suggestions[0].suggested_amount > 0


# ========== 4. Budget API 端点测试 ==========

class TestBudgetAPI:
    def test_set_budget(self, api):
        resp = api.post("/api/v1/budgets/", json={
            "year": 2026, "month": 6, "category": "餐饮", "amount": 1000.0,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == 1000.0
        assert data["category"] == "餐饮"

    def test_get_budgets(self, api):
        api.post("/api/v1/budgets/", json={"year": 2026, "month": 6, "category": "餐饮", "amount": 800.0})
        api.post("/api/v1/budgets/", json={"year": 2026, "month": 6, "category": "交通", "amount": 300.0})
        resp = api.get("/api/v1/budgets/?year=2026&month=6")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_update_budget(self, api):
        created = api.post("/api/v1/budgets/", json={"year": 2026, "month": 6, "category": "娱乐", "amount": 500.0})
        bid = created.json()["id"]
        resp = api.put(f"/api/v1/budgets/{bid}", json={"amount": 600.0})
        assert resp.status_code == 200
        assert resp.json()["amount"] == 600.0

    def test_delete_budget(self, api):
        created = api.post("/api/v1/budgets/", json={"year": 2026, "month": 6, "category": "购物", "amount": 200.0})
        bid = created.json()["id"]
        resp = api.delete(f"/api/v1/budgets/{bid}")
        assert resp.status_code == 200

    def test_vs_actual_endpoint(self, db, api):
        seed_budget_data(db)
        api.post("/api/v1/budgets/", json={"year": 2026, "month": 6, "category": "餐饮", "amount": 500.0})
        api.post("/api/v1/budgets/", json={"year": 2026, "month": 6, "category": "交通", "amount": 200.0})

        resp = api.get("/api/v1/budgets/vs-actual?year=2026&month=6")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_budget"] == 700.0
        assert data["total_actual"] == 550.0

    def test_suggest_endpoint(self, api):
        api.post("/api/v1/budgets/", json={"year": 2026, "month": 6, "category": "餐饮", "amount": 500.0})
        resp = api.get("/api/v1/budgets/suggest?year=2026&month=7")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_invalid_params(self, api):
        resp = api.get("/api/v1/budgets/?year=2026&month=13")
        assert resp.status_code == 422


class TestAutoGenerate:
    def test_auto_generate_from_previous_month(self, db):
        """基于上月消费数据自动生成当月预算"""
        from app.services.bill_service import BillService
        from app.services.budget_service import BudgetService
        from app.schemas.bill import BillCreate

        # 上月 (2026-05) 创建消费记录
        bill_svc = BillService(db)
        bill_svc.create_bill(BillCreate(amount=-500.0, category="餐饮",
                                        transaction_date="2026-05-10 12:00:00"))
        bill_svc.create_bill(BillCreate(amount=-300.0, category="交通",
                                        transaction_date="2026-05-15 12:00:00"))

        # 自动生成 2026-06 预算
        budget_svc = BudgetService(db)
        created = budget_svc.auto_generate(2026, 6)

        assert len(created) == 2
        categories = {b.category for b in created}
        assert "餐饮" in categories
        assert "交通" in categories

        # 检查金额：餐饮 500 * 1.10 = 550
        dining = [b for b in created if b.category == "餐饮"][0]
        assert dining.amount == 550.0

    def test_auto_generate_skips_existing(self, db):
        """已有预算的分类不覆盖"""
        from app.services.bill_service import BillService
        from app.services.budget_service import BudgetService
        from app.schemas.bill import BillCreate
        from app.schemas.budget import BudgetCreate

        bill_svc = BillService(db)
        bill_svc.create_bill(BillCreate(amount=-500.0, category="餐饮",
                                        transaction_date="2026-05-10 12:00:00"))

        budget_svc = BudgetService(db)
        # 手动设置餐饮预算
        budget_svc.set_budget(BudgetCreate(year=2026, month=6, category="餐饮", amount=1000))

        # 自动生成
        created = budget_svc.auto_generate(2026, 6)
        # 餐饮已有预算，不应被覆盖
        categories = {b.category for b in created}
        assert "餐饮" not in categories  # 已存在，跳过

    def test_auto_generate_no_previous_data(self, db):
        """上月无消费数据时返回空列表"""
        from app.services.budget_service import BudgetService

        budget_svc = BudgetService(db)
        created = budget_svc.auto_generate(2026, 6)
        assert created == []

    def test_auto_generate_endpoint(self, api, db):
        """API 端点测试"""
        from app.services.bill_service import BillService
        from app.schemas.bill import BillCreate

        bill_svc = BillService(db)
        bill_svc.create_bill(BillCreate(amount=-200.0, category="购物",
                                        transaction_date="2026-05-20 12:00:00"))

        resp = api.post("/api/v1/budgets/auto-generate?year=2026&month=6")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["category"] == "购物"
        assert data[0]["amount"] == 220.0  # 200 * 1.10


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
