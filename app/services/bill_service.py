# app/services/bill_service.py

from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.bill import Bill
from app.schemas.bill import BillCreate, BillUpdate, FlexibleBillRecord
from app.services.category_service import CategoryService
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class BillService:
    def __init__(self, db: Session):
        self.db = db

    def _resolve_category_id(self, category_name: str) -> Optional[int]:
        """根据分类名查找 category_id，找不到返回 None"""
        if not category_name:
            return None
        cat_svc = CategoryService(self.db)
        cats = cat_svc.get_all()
        for c in cats:
            if c.name == category_name:
                return c.id
        return None

    def create_bill(self, bill_data: BillCreate, user_id: int) -> Bill:
        # 先检查是否已存在相同记录（避免重复创建）
        existing = self._find_duplicate_bill(bill_data, user_id)
        if existing:
            # 如果记录存在但 user_id 为 NULL，更新 user_id
            if existing.user_id is None:
                existing.user_id = user_id
                self.db.commit()
                self.db.refresh(existing)
            return existing

        db_bill = Bill(**bill_data.model_dump(), user_id=user_id)
        # 自动补全 category_id
        if not db_bill.category_id and db_bill.category:
            db_bill.category_id = self._resolve_category_id(db_bill.category)
        self.db.add(db_bill)
        self.db.commit()
        self.db.refresh(db_bill)
        return db_bill

    def _find_duplicate_bill(self, bill_data: BillCreate, user_id: int) -> Optional[Bill]:
        """查找是否存在重复账单记录

        检查逻辑：
        1. 如果 bill_data 有 transaction_id，按 transaction_id 查找
        2. 否则按 transaction_date + amount + category 查找
        3. 同时匹配 user_id 为 NULL 或相同 user_id 的记录
        """
        q = self.db.query(Bill)

        # 按 transaction_id 查找
        if hasattr(bill_data, 'transaction_id') and bill_data.transaction_id:
            q = q.filter(Bill.transaction_id == bill_data.transaction_id)
        else:
            # 按日期+金额+分类查找
            if bill_data.transaction_date:
                q = q.filter(
                    Bill.transaction_date == bill_data.transaction_date,
                    Bill.amount == bill_data.amount,
                )
                if bill_data.category:
                    q = q.filter(Bill.category == bill_data.category)
            else:
                return None

        # 匹配 user_id 为 NULL 或相同 user_id 的记录
        from sqlalchemy import or_
        q = q.filter(
            or_(
                Bill.user_id.is_(None),
                Bill.user_id == user_id,
            )
        )

        return q.first()

    def get_bill_by_id(self, bill_id: int) -> Optional[Bill]:
        """根据 ID 获取单个账单"""
        return self.db.query(Bill).filter(Bill.id == bill_id).first()

    def get_bills(self, skip: int = 0, limit: int = 100, order: str = "desc", user_id: Optional[int] = None):
        """获取账单列表，默认按时间倒序（最新在前）

        Args:
            user_id: 用户 ID，为 None 时返回所有账单（向后兼容）
        """
        q = self.db.query(Bill)
        if user_id is not None:
            q = q.filter(Bill.user_id == user_id)
        if order == "asc":
            q = q.order_by(Bill.transaction_date.asc().nullsfirst())
        else:
            q = q.order_by(Bill.transaction_date.desc().nullslast())
        return q.offset(skip).limit(limit).all()

    def update_bill(self, bill_id: int, data: BillUpdate) -> Optional[Bill]:
        """更新已有账单的部分字段"""
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        update_dict = data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            setattr(bill, key, val)
        # 如果更新了 category，自动补全 category_id
        if "category" in update_dict and not update_dict.get("category_id"):
            bill.category_id = self._resolve_category_id(bill.category)
        self.db.commit()
        self.db.refresh(bill)
        return bill

    def delete_bill(self, bill_id: int) -> bool:
        """删除指定账单，返回是否成功"""
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return False
        self.db.delete(bill)
        self.db.commit()
        logger.info(f"账单已删除: id={bill_id}")
        return True

    def search_bills(self, keyword: str = "", start_date: str = "",
                     end_date: str = "", category: str = "",
                     skip: int = 0, limit: int = 100, user_id: Optional[int] = None) -> List[Bill]:
        """搜索账单：支持关键词（匹配 payee/description/remark）、日期范围、分类

        Args:
            user_id: 用户 ID，为 None 时返回所有账单（向后兼容）
        """
        q = self.db.query(Bill)
        if user_id is not None:
            q = q.filter(Bill.user_id == user_id)

        if keyword:
            like_pat = f"%{keyword}%"
            q = q.filter(or_(
                Bill.payee.like(like_pat),
                Bill.description.like(like_pat),
                Bill.remark.like(like_pat),
            ))

        if start_date:
            try:
                dt = datetime.strptime(start_date, "%Y-%m-%d")
                q = q.filter(Bill.transaction_date >= dt)
            except ValueError:
                pass

        if end_date:
            try:
                dt = datetime.strptime(end_date, "%Y-%m-%d")
                q = q.filter(Bill.transaction_date <= dt)
            except ValueError:
                pass

        if category:
            q = q.filter(Bill.category == category)

        return q.order_by(Bill.transaction_date.desc().nullslast()).offset(skip).limit(limit).all()

    def _auto_categorize(self, rec: FlexibleBillRecord) -> tuple[str, Optional[int]]:
        """自动匹配分类，返回 (分类名, 分类ID)。匹配不到则使用 其他（兜底分类）。"""
        cat_svc = CategoryService(self.db)
        search_text = " ".join(filter(None, [
            rec.payee or "",
            rec.description or "",
            rec.transaction_type or "",
            rec.remark or "",
        ]))
        matched = cat_svc.auto_match(search_text)
        if matched:
            return matched.name, matched.id
        # 优先使用 transaction_type，其次使用 "其他"（种子数据中的兜底分类）
        fallback = rec.transaction_type or "其他"
        fallback_id = self._resolve_category_id(fallback)
        return fallback, fallback_id

    def import_from_parsed_records(self, records: List[FlexibleBillRecord], user_id: int) -> dict:
        db = self.db
        created = 0
        skipped = 0
        errors = []
        for rec in records:
            try:
                # 改进的重复检测：同时检查 user_id 为 NULL 和具体 user_id 的记录
                if rec.transaction_id:
                    # 先检查 transaction_id 是否已存在（不考虑 user_id）
                    existing = db.query(Bill).filter(
                        Bill.transaction_id == rec.transaction_id
                    ).first()
                else:
                    if rec.transaction_date is None:
                        skipped += 1
                        continue
                    # 检查相同日期、金额、收款人的记录（不考虑 user_id）
                    existing = db.query(Bill).filter(
                        Bill.transaction_date == rec.transaction_date,
                        Bill.amount == rec.amount,
                        Bill.payee == rec.payee,
                    ).first()

                if existing:
                    # 如果记录存在但 user_id 为 NULL，更新 user_id
                    if existing.user_id is None:
                        existing.user_id = user_id
                        db.commit()
                        # 不算新建也不算跳过，是更新
                    skipped += 1
                    continue

                category_name, category_id = self._auto_categorize(rec)

                bill_create = BillCreate(
                    amount=abs(rec.amount) if rec.amount else 0,
                    category=category_name,
                    category_id=category_id,
                    note=rec.remark,
                    raw_text=rec.raw_line,
                    transaction_date=rec.transaction_date,
                )
                bill = Bill(
                    **bill_create.model_dump(),
                    user_id=user_id,
                    direction=rec.direction,
                    payee=rec.payee,
                    description=rec.description,
                    transaction_type=rec.transaction_type,
                    payment_method=rec.payment_method,
                    transaction_status=rec.transaction_status,
                    transaction_id=rec.transaction_id,
                    merchant_order_id=rec.merchant_order_id,
                    remark=rec.remark,
                    source_file_type=rec.source_file_type,
                )
                db.add(bill)
                db.commit()
                created += 1
            except Exception as e:
                db.rollback()
                logger.exception(f"导入账单失败: {rec.raw_line}")
                errors.append(str(e))
        return {"created": created, "skipped": skipped, "errors": errors}