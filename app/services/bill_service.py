# app/services/bill_service.py

from sqlalchemy.orm import Session
from app.models.bill import Bill
from app.schemas.bill import BillCreate, FlexibleBillRecord
from typing import List
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
    
    def import_from_parsed_records(self, records: List[FlexibleBillRecord]) -> dict:
        db = self.db
        created = 0
        skipped = 0
        errors = []
        for rec in records:
            try:
                # 去重：如果有交易单号则使用，否则使用日期+金额+对方组合
                if rec.transaction_id:
                    existing = db.query(Bill).filter(Bill.transaction_id == rec.transaction_id).first()
                else:
                    # 粗略去重：同一天相同金额相同对方
                    existing = db.query(Bill).filter(
                        Bill.transaction_date.date() == rec.transaction_date.date(),
                        Bill.amount == rec.amount,
                        Bill.payee == rec.payee
                    ).first()
                if existing:
                    skipped += 1
                    continue
                   
                # 构造 BillCreate
                bill_create = BillCreate(
                    amount=rec.amount or 0, 
                    category=rec.transaction_type or "未分类",
                    note=rec.remark,
                    raw_text=rec.raw_line,
                    transaction_date=rec.transaction_date
                )
                bill = Bill(
                    **bill_create.model_dump(),

                    # 扩展字段
                    direction=rec.direction,
                    payee=rec.payee,
                    description=rec.description,
                    transaction_type=rec.transaction_type,
                    payment_method=rec.payment_method,
                    transaction_status=rec.transaction_status,
                    transaction_id=rec.transaction_id,
                    merchant_order_id=rec.merchant_order_id,
                    remark=rec.remark,
                    source_file_type=rec.source_file_type
                )
                db.add(bill)
                db.commit()
                created += 1
            except Exception as e:
                db.rollback()
                logger.exception(
                    f"导入账单失败: {rec.raw_line}"
                )
                errors.append(str(e))
        return {"created": created, "skipped": skipped, "errors": errors}