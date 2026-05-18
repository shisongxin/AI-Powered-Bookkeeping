# app/services/bill_service.py

from sqlalchemy.orm import Session
from app.models.bill import Bill
from app.schemas.bill import BillCreate, FlexibleBillRecord
from app.services.category_service import CategoryService
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class BillService:
    def __init__(self, db: Session):
        self.db = db

    def create_bill(self, bill_data: BillCreate) -> Bill:
        db_bill = Bill(**bill_data.model_dump())
        self.db.add(db_bill)
        self.db.commit()
        self.db.refresh(db_bill)
        return db_bill

    def get_bills(self, skip: int = 0, limit: int = 100):
        return self.db.query(Bill).offset(skip).limit(limit).all()

    def _auto_categorize(self, rec: FlexibleBillRecord) -> tuple[str, Optional[int]]:
        """自动匹配分类，返回 (分类名, 分类ID)"""
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
        return rec.transaction_type or "未分类", None

    def import_from_parsed_records(self, records: List[FlexibleBillRecord]) -> dict:
        db = self.db
        created = 0
        skipped = 0
        errors = []
        for rec in records:
            try:
                if rec.transaction_id:
                    existing = db.query(Bill).filter(Bill.transaction_id == rec.transaction_id).first()
                else:
                    if rec.transaction_date is None:
                        skipped += 1
                        continue
                    existing = db.query(Bill).filter(
                        Bill.transaction_date == rec.transaction_date,
                        Bill.amount == rec.amount,
                        Bill.payee == rec.payee,
                    ).first()
                if existing:
                    skipped += 1
                    continue

                category_name, category_id = self._auto_categorize(rec)

                bill_create = BillCreate(
                    amount=rec.amount or 0,
                    category=category_name,
                    category_id=category_id,
                    note=rec.remark,
                    raw_text=rec.raw_line,
                    transaction_date=rec.transaction_date,
                )
                bill = Bill(
                    **bill_create.model_dump(),
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