# tests/test_categories.py

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.models.bill import Bill
from app.models.category import Category
from app.schemas.bill import FlexibleBillRecord
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.services.category_service import CategoryService
from app.services.bill_service import BillService
from app.main import app


# ---------- SQLite 内存数据库 ----------

SQLITE_URL = "sqlite:///./test_categories.db"
engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    yield session
    session.close()


# ---------- 种子数据辅助 ----------

SEED_CATEGORIES = [
    {"name": "餐饮", "icon": "🍜", "color": "#FF6B6B", "keywords": "餐厅,外卖,美食,饭,面,火锅,奶茶,咖啡,早餐,午餐,晚餐"},
    {"name": "交通", "icon": "🚇", "color": "#4ECDC4", "keywords": "地铁,公交,打车,滴滴,出租车,高铁,火车,机票"},
    {"name": "购物", "icon": "🛒", "color": "#45B7D1", "keywords": "淘宝,京东,超市,商场,便利店"},
    {"name": "收入", "icon": "💰", "color": "#90EE90", "keywords": "工资,奖金,红包,退款,报销"},
    {"name": "其他", "icon": "📋", "color": "#C0C0C0", "keywords": ""},
]


def seed_categories(db):
    for cat in SEED_CATEGORIES:
        svc = CategoryService(db)
        svc.create(CategoryCreate(**cat))


# ========== 1. CategoryService CRUD 测试 ==========

class TestCategoryService:
    def test_create(self, db):
        svc = CategoryService(db)
        cat = svc.create(CategoryCreate(name="餐饮", icon="🍜", keywords="外卖,火锅"))
        assert cat.id is not None
        assert cat.name == "餐饮"
        assert cat.icon == "🍜"

    def test_create_duplicate_name_raises(self, db):
        svc = CategoryService(db)
        svc.create(CategoryCreate(name="餐饮"))
        with pytest.raises(Exception):
            svc.create(CategoryCreate(name="餐饮"))

    def test_get_all(self, db):
        seed_categories(db)
        svc = CategoryService(db)
        cats = svc.get_all()
        assert len(cats) == len(SEED_CATEGORIES)
        assert cats[0].name == "餐饮"

    def test_get_by_id(self, db):
        svc = CategoryService(db)
        created = svc.create(CategoryCreate(name="交通"))
        found = svc.get(created.id)
        assert found is not None
        assert found.name == "交通"

    def test_get_not_found(self, db):
        svc = CategoryService(db)
        assert svc.get(9999) is None

    def test_update(self, db):
        svc = CategoryService(db)
        cat = svc.create(CategoryCreate(name="旧名称"))
        updated = svc.update(cat.id, CategoryUpdate(name="新名称", color="#FF0000"))
        assert updated is not None
        assert updated.name == "新名称"
        assert updated.color == "#FF0000"

    def test_update_not_found(self, db):
        svc = CategoryService(db)
        assert svc.update(9999, CategoryUpdate(name="X")) is None

    def test_delete(self, db):
        svc = CategoryService(db)
        cat = svc.create(CategoryCreate(name="待删除"))
        assert svc.delete(cat.id) is True
        assert svc.get(cat.id) is None

    def test_delete_not_found(self, db):
        svc = CategoryService(db)
        assert svc.delete(9999) is False


# ========== 2. 自动分类匹配测试 ==========

class TestAutoCategorize:
    def test_match_by_payee_keyword(self, db):
        seed_categories(db)
        svc = CategoryService(db)
        matched = svc.auto_match("麦当劳餐厅")
        assert matched is not None
        assert matched.name == "餐饮"

    def test_match_by_description_keyword(self, db):
        seed_categories(db)
        svc = CategoryService(db)
        matched = svc.auto_match("滴滴出行快车服务")
        assert matched is not None
        assert matched.name == "交通"

    def test_match_highest_score_wins(self, db):
        seed_categories(db)
        svc = CategoryService(db)
        # "咖啡" 匹配 餐饮，但如果在超市买咖啡，应该匹配到购物
        matched = svc.auto_match("超市 咖啡")
        # 超市和咖啡各1票，先创建的先匹配（餐饮先于购物），但分数相同时取第一个
        assert matched is not None
        assert matched.name in ("餐饮", "购物")

    def test_no_match_returns_none(self, db):
        seed_categories(db)
        svc = CategoryService(db)
        matched = svc.auto_match("完全未知的文本")
        assert matched is None

    def test_empty_text_returns_none(self, db):
        seed_categories(db)
        svc = CategoryService(db)
        assert svc.auto_match("") is None
        assert svc.auto_match(None) is None

    def test_category_without_keywords_skipped(self, db):
        seed_categories(db)
        svc = CategoryService(db)
        # "其他"分类没有关键词，应该匹配不到
        matched = svc.auto_match("乱七八糟")
        assert matched is None


# ========== 3. BillService 导入 + 自动分类测试 ==========

class TestBillImportWithCategory:
    def test_import_auto_categorizes(self, db):
        seed_categories(db)
        svc = BillService(db)

        records = [
            FlexibleBillRecord(
                transaction_date="2026-05-15 12:30:00",
                amount=-35.0,
                direction="支出",
                payee="麦当劳",
                description="午餐外卖",
                transaction_type="餐饮",
                source_file_type="test",
            ),
            FlexibleBillRecord(
                transaction_date="2026-05-15 18:00:00",
                amount=-200.0,
                direction="支出",
                payee="滴滴出行",
                description="打车回家",
                transaction_type="交通出行",
                source_file_type="test",
            ),
            FlexibleBillRecord(
                transaction_date="2026-05-16 09:00:00",
                amount=-99.0,
                direction="支出",
                payee="京东商城",
                description="日用品",
                transaction_type="网上购物",
                source_file_type="test",
            ),
        ]

        result = svc.import_from_parsed_records(records)
        assert result["created"] == 3
        assert result["skipped"] == 0

        bills = svc.get_bills()
        assert len(bills) == 3

        # 验证自动分类
        assert bills[0].category == "餐饮"
        assert bills[0].category_id is not None
        assert bills[1].category == "交通"
        assert bills[2].category == "购物"

    def test_import_deduplication(self, db):
        seed_categories(db)
        svc = BillService(db)

        rec = FlexibleBillRecord(
            transaction_date="2026-05-15 12:30:00",
            amount=-35.0,
            direction="支出",
            payee="麦当劳",
            transaction_id="TXN-001",
            source_file_type="test",
        )
        svc.import_from_parsed_records([rec])
        result = svc.import_from_parsed_records([rec])
        assert result["created"] == 0
        assert result["skipped"] == 1

    def test_import_no_match_falls_back(self, db):
        seed_categories(db)
        svc = BillService(db)

        records = [
            FlexibleBillRecord(
                transaction_date="2026-05-15 12:00:00",
                amount=-50.0,
                direction="支出",
                payee="未知商户",
                description="神秘消费",
                transaction_type="神秘类型",
                source_file_type="test",
            ),
        ]
        result = svc.import_from_parsed_records(records)
        assert result["created"] == 1
        bills = svc.get_bills()
        assert bills[0].category == "神秘类型"
        assert bills[0].category_id is None


# ========== 4. Categories API 端点测试 ==========

class TestCategoriesAPI:
    def test_create_category(self):
        resp = client.post("/api/v1/categories/", json={
            "name": "医疗", "icon": "💊", "keywords": "医院,药,门诊"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "医疗"
        assert data["id"] is not None

    def test_get_all_categories(self):
        client.post("/api/v1/categories/", json={"name": "A"})
        client.post("/api/v1/categories/", json={"name": "B"})
        resp = client.get("/api/v1/categories/")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_single_category(self):
        created = client.post("/api/v1/categories/", json={"name": "教育"})
        cat_id = created.json()["id"]
        resp = client.get(f"/api/v1/categories/{cat_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "教育"

    def test_get_category_not_found(self):
        resp = client.get("/api/v1/categories/99999")
        assert resp.status_code == 404

    def test_update_category(self):
        created = client.post("/api/v1/categories/", json={"name": "旧名称"})
        cat_id = created.json()["id"]
        resp = client.put(f"/api/v1/categories/{cat_id}", json={
            "name": "新名称", "color": "#ABC"
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "新名称"
        assert resp.json()["color"] == "#ABC"

    def test_delete_category(self):
        created = client.post("/api/v1/categories/", json={"name": "待删除"})
        cat_id = created.json()["id"]
        resp = client.delete(f"/api/v1/categories/{cat_id}")
        assert resp.status_code == 200
        assert client.get(f"/api/v1/categories/{cat_id}").status_code == 404

    def test_delete_not_found(self):
        resp = client.delete("/api/v1/categories/99999")
        assert resp.status_code == 404


# ========== 5. Bills API 端点测试 ==========

class TestBillsAPI:
    def test_create_bill_with_category(self):
        # 先创建分类
        cat_resp = client.post("/api/v1/categories/", json={"name": "餐饮"})
        cat_id = cat_resp.json()["id"]

        resp = client.post("/api/v1/bills/", json={
            "amount": 35.0,
            "category": "餐饮",
            "category_id": cat_id,
            "transaction_date": "2026-05-15T12:30:00",
        })
        assert resp.status_code == 200
        assert resp.json()["category"] == "餐饮"
        assert resp.json()["category_id"] == cat_id

    def test_get_bills(self):
        client.post("/api/v1/bills/", json={
            "amount": 100.0, "category": "未分类",
            "transaction_date": "2026-05-15T12:00:00",
        })
        resp = client.get("/api/v1/bills/")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
