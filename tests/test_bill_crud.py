"""账单 CRUD 增强测试 — 更新 + 搜索 + 其他分类"""

import pytest
from app.services.bill_service import BillService
from app.schemas.bill import BillCreate, BillUpdate, FlexibleBillRecord
from tests.test_categories import seed_categories


class TestBillUpdate:
    def test_update_amount(self, db):
        """更新账单金额"""
        svc = BillService(db)
        bill = svc.create_bill(BillCreate(amount=-35.0, category="餐饮",
                                          transaction_date="2026-06-01 12:00:00"))
        updated = svc.update_bill(bill.id, BillUpdate(amount=-50.0))
        assert updated is not None
        assert updated.amount == -50.0
        assert updated.category == "餐饮"  # 未修改的字段保持不变

    def test_update_category(self, db):
        """更新账单分类，自动补全 category_id"""
        seed_categories(db)
        svc = BillService(db)
        bill = svc.create_bill(BillCreate(amount=-35.0, category="餐饮"))
        updated = svc.update_bill(bill.id, BillUpdate(category="交通"))
        assert updated is not None
        assert updated.category == "交通"
        # category_id 应被自动补全
        assert updated.category_id is not None

    def test_update_nonexistent(self, db):
        """更新不存在的账单返回 None"""
        svc = BillService(db)
        assert svc.update_bill(99999, BillUpdate(amount=100)) is None

    def test_update_partial(self, db):
        """部分更新：只修改 payee，不动金额和分类"""
        svc = BillService(db)
        bill = svc.create_bill(BillCreate(amount=-35.0, category="餐饮",
                                          transaction_date="2026-06-01 12:00:00"))
        updated = svc.update_bill(bill.id, BillUpdate(payee="测试商户"))
        assert updated is not None
        assert updated.payee == "测试商户"
        assert updated.amount == -35.0
        assert updated.category == "餐饮"


class TestBillSearch:
    def test_search_by_keyword(self, db):
        """按关键词搜索（匹配商户名）"""
        svc = BillService(db)
        svc.create_bill(BillCreate(amount=-35.0, category="餐饮",
                                   transaction_date="2026-06-01 12:00:00"))
        b2 = svc.create_bill(BillCreate(amount=-200.0, category="交通",
                                        transaction_date="2026-06-02 12:00:00"))
        # 通过 BillUpdate 设置 payee
        svc.update_bill(b2.id, BillUpdate(payee="滴滴出行"))

        results = svc.search_bills(keyword="滴滴")
        assert len(results) >= 1
        assert any("滴滴" in (r.payee or "") for r in results)

    def test_search_by_category(self, db):
        """按分类搜索"""
        svc = BillService(db)
        svc.create_bill(BillCreate(amount=-35.0, category="餐饮"))
        svc.create_bill(BillCreate(amount=-200.0, category="交通"))

        results = svc.search_bills(category="交通")
        assert len(results) >= 1
        assert all(r.category == "交通" for r in results)

    def test_search_by_date_range(self, db):
        """按日期范围搜索"""
        svc = BillService(db)
        svc.create_bill(BillCreate(amount=-35.0, category="餐饮",
                                   transaction_date="2026-06-15 12:00:00"))
        svc.create_bill(BillCreate(amount=-200.0, category="交通",
                                   transaction_date="2026-07-01 12:00:00"))

        results = svc.search_bills(start_date="2026-06-01", end_date="2026-06-30")
        assert len(results) >= 1
        # 只应包含 6 月的账单
        for r in results:
            assert r.transaction_date is None or r.transaction_date.month == 6

    def test_search_empty(self, db):
        """空搜索返回所有账单"""
        svc = BillService(db)
        svc.create_bill(BillCreate(amount=-35.0, category="餐饮"))
        svc.create_bill(BillCreate(amount=-200.0, category="交通"))
        results = svc.search_bills()
        assert len(results) >= 2


class TestOtherCategory:
    def test_create_bill_with_other_category(self, db):
        """创建分类为"其他"的账单应成功入库"""
        seed_categories(db)
        svc = BillService(db)
        bill = svc.create_bill(BillCreate(amount=-99.0, category="其他"))
        assert bill.id is not None
        assert bill.category == "其他"
        # category_id 应被自动补全（其他 在种子数据中）
        assert bill.category_id is not None

    def test_auto_categorize_fallback_to_other(self, db):
        """自动分类匹配失败时回退到"其他"而非"未分类" """
        seed_categories(db)
        svc = BillService(db)
        # 一个无法匹配任何关键词的记录
        rec = FlexibleBillRecord(
            amount=-50.0,
            payee="完全不认识的商户XYZ",
            transaction_date="2026-06-01 12:00:00",
        )
        name, cid = svc._auto_categorize(rec)
        # 应回退到"其他"（兜底分类存在于种子数据中）
        assert name == "其他"
        assert cid is not None

    def test_import_uses_other_fallback(self, db):
        """批量导入时无匹配记录应使用"其他"分类"""
        seed_categories(db)
        svc = BillService(db)
        records = [
            FlexibleBillRecord(
                amount=-50.0,
                payee="未知商店",
                transaction_date="2026-06-01 12:00:00",
            ),
        ]
        result = svc.import_from_parsed_records(records)
        assert result["created"] == 1

        bills = svc.get_bills()
        assert len(bills) >= 1
        # 新创建的账单分类应为"其他"
        bill = [b for b in bills if b.payee == "未知商店"][0]
        assert bill.category == "其他"
