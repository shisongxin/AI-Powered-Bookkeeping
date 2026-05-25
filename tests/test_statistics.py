# tests/test_statistics.py

import pytest
from datetime import datetime

from app.models.bill import Bill
from app.models.category import Category


# ---------- 种子数据 ----------

def seed_test_data(db):
    cats = [
        Category(name="餐饮", keywords="外卖,餐厅"),
        Category(name="交通", keywords="地铁,打车"),
        Category(name="收入", keywords="工资,奖金"),
    ]
    for c in cats:
        db.add(c)
    db.commit()

    bills = [
        # 餐饮 — 3笔
        Bill(amount=-35.0, category="餐饮", transaction_date=datetime(2026, 5, 1, 12, 0)),
        Bill(amount=-80.0, category="餐饮", transaction_date=datetime(2026, 5, 10, 19, 0)),
        Bill(amount=-22.0, category="餐饮", transaction_date=datetime(2026, 5, 20, 8, 0)),
        # 交通 — 2笔
        Bill(amount=-200.0, category="交通", transaction_date=datetime(2026, 5, 5, 9, 0)),
        Bill(amount=-15.0, category="交通", transaction_date=datetime(2026, 5, 15, 18, 0)),
        # 收入 — 2笔
        Bill(amount=5000.0, category="收入", transaction_date=datetime(2026, 5, 1, 10, 0)),
        Bill(amount=300.0, category="收入", transaction_date=datetime(2026, 5, 25, 14, 0)),
        # 6月数据（跨月测试趋势）
        Bill(amount=-50.0, category="餐饮", transaction_date=datetime(2026, 6, 3, 12, 0)),
        Bill(amount=5000.0, category="收入", transaction_date=datetime(2026, 6, 1, 10, 0)),
    ]
    for b in bills:
        db.add(b)
    db.commit()


# ========== 1. 月度汇总测试 ==========

class TestMonthlySummary:
    def test_may_2026(self, db, api):
        seed_test_data(db)
        resp = api.get("/api/v1/statistics/monthly-summary?year=2026&month=5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["year"] == 2026
        assert data["month"] == 5
        assert data["income"] == 5300.0
        assert data["expense"] == 352.0
        assert data["net"] == 4948.0
        assert data["transaction_count"] == 7

    def test_empty_month(self, api):
        resp = api.get("/api/v1/statistics/monthly-summary?year=2025&month=1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["income"] == 0.0
        assert data["expense"] == 0.0
        assert data["net"] == 0.0

    def test_invalid_params(self, api):
        resp = api.get("/api/v1/statistics/monthly-summary?year=2026&month=13")
        assert resp.status_code == 422


# ========== 2. 按分类统计测试 ==========

class TestCategoryBreakdown:
    def test_expense_breakdown(self, db, api):
        seed_test_data(db)
        resp = api.get(
            "/api/v1/statistics/by-category?"
            "start_date=2026-05-01&end_date=2026-05-31&direction=支出"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
        result = {d["category"]: d for d in data}
        assert result["餐饮"]["amount"] == 137.0
        assert result["餐饮"]["count"] == 3
        assert result["交通"]["amount"] == 215.0
        assert result["交通"]["count"] == 2
        assert result["交通"]["percentage"] == pytest.approx(61.1, abs=0.5)
        assert result["餐饮"]["percentage"] == pytest.approx(38.9, abs=0.5)

    def test_income_breakdown(self, db, api):
        seed_test_data(db)
        resp = api.get(
            "/api/v1/statistics/by-category?"
            "start_date=2026-05-01&end_date=2026-05-31&direction=收入"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["category"] == "收入"
        assert data[0]["amount"] == 5300.0

    def test_no_date_range(self, db, api):
        seed_test_data(db)
        resp = api.get("/api/v1/statistics/by-category?direction=支出")
        assert resp.status_code == 200
        data = resp.json()
        total = sum(item["amount"] for item in data)
        assert total == 402.0

    def test_invalid_direction(self, api):
        resp = api.get("/api/v1/statistics/by-category?direction=转账")
        assert resp.status_code == 422


# ========== 3. 消费趋势测试 ==========

class TestTrend:
    def test_monthly_trend(self, db, api):
        seed_test_data(db)
        resp = api.get(
            "/api/v1/statistics/trend?"
            "start_date=2026-05-01&end_date=2026-06-30&granularity=monthly"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["period"] == "2026-05"
        assert data[0]["income"] == 5300.0
        assert data[0]["expense"] == 352.0
        assert data[0]["net"] == 4948.0
        assert data[1]["period"] == "2026-06"
        assert data[1]["income"] == 5000.0
        assert data[1]["expense"] == 50.0

    def test_daily_trend(self, db, api):
        seed_test_data(db)
        resp = api.get(
            "/api/v1/statistics/trend?"
            "start_date=2026-05-01&end_date=2026-05-01&granularity=daily"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["period"] == "2026-05-01"
        assert data[0]["income"] == 5000.0
        assert data[0]["expense"] == 35.0

    def test_invalid_granularity(self, api):
        resp = api.get(
            "/api/v1/statistics/trend?"
            "start_date=2026-01-01&end_date=2026-06-30&granularity=annually"
        )
        assert resp.status_code == 422

    def test_no_data_range(self, api):
        resp = api.get(
            "/api/v1/statistics/trend?"
            "start_date=2024-01-01&end_date=2024-12-31&granularity=monthly"
        )
        assert resp.status_code == 200
        assert resp.json() == []


# ========== 4. 集成测试：导入后统计 ==========

class TestImportThenStatistics:
    def test_import_then_summarize(self, api):
        api.post("/api/v1/categories/", json={
            "name": "餐饮", "keywords": "外卖,麦当劳"
        })
        api.post("/api/v1/categories/", json={
            "name": "交通", "keywords": "滴滴,打车"
        })

        bills_data = [
            {"amount": -35.0, "category": "餐饮", "transaction_date": "2026-05-15T12:30:00"},
            {"amount": -100.0, "category": "餐饮", "transaction_date": "2026-05-16T19:00:00"},
            {"amount": -50.0, "category": "交通", "transaction_date": "2026-05-17T09:00:00"},
            {"amount": 8000.0, "category": "工资", "transaction_date": "2026-05-01T10:00:00"},
        ]
        for b in bills_data:
            resp = api.post("/api/v1/bills/", json=b)
            assert resp.status_code == 200

        resp = api.get("/api/v1/statistics/monthly-summary?year=2026&month=5")
        assert resp.json()["income"] == 8000.0
        assert resp.json()["expense"] == 185.0
        assert resp.json()["transaction_count"] == 4

        resp = api.get(
            "/api/v1/statistics/by-category?"
            "start_date=2026-05-01&end_date=2026-05-31&direction=支出"
        )
        data = resp.json()
        assert len(data) == 2
        assert {d["category"] for d in data} == {"餐饮", "交通"}


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
