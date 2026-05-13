# app/services/bill_service.py
from sqlalchemy.orm import Session
from app.models.bill import Bill
from app.schemas.bill import BillCreate, BillResponse, UnifiedBillRecord
from app.utils.wechat_parser import parse_wechat_bill
from app.utils.alipay_parser import parse_alipay_bill
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
    
    @staticmethod
    def import_from_csv(db: Session, file_path: str, source_type: str) -> dict:
        """
        从CSV文件导入账单

        Args:
            db: 数据库会话
            file_path: CSV文件路径
            source_type: 来源类型 'wechat' 或 'alipay'

        Returns:
            导入结果统计
        """
        # 1. 调用对应的解析器
        if source_type == 'wechat':
            unified_records = parse_wechat_bill(file_path)
        elif source_type == 'alipay':
            unified_records = parse_alipay_bill(file_path)
        else:
            raise ValueError("source_type must be 'wechat' or 'alipay'")

        # 2. 批量导入数据库（去重 + 转换）
        created_count = 0
        skipped_count = 0
        errors = []

        for record in unified_records:
            try:
                # 检查是否已存在（通过 transaction_id 去重）
                existing = db.query(Bill).filter(
                    Bill.transaction_id == record.transaction_id
                ).first()

                if existing:
                    skipped_count += 1
                    continue

                # 转换为 BillCreate 对象
                # 注意：bill_type 根据金额正负自动判断
                bill_data = BillCreate(
                    transaction_date=record.transaction_date,
                    amount=record.amount_numeric,
                    description=record.description or f"{record.transaction_type} - {record.payee}",
                    category=None,  # 后续可由 Agent 自动分类
                    bill_type='expense' if record.amount_numeric < 0 else 'income',
                    transaction_id=record.transaction_id,
                    payee=record.payee,
                    payment_method=record.payment_method,
                    remark=record.remark,
                )

                bill = Bill(**bill_data.dict())
                db.add(bill)
                created_count += 1

            except Exception as e:
                errors.append(f"导入失败: {record.transaction_id}, error={str(e)}")
                logger.error(f"导入账单失败: {record.transaction_id}, error={e}")

        db.commit()

        return {
            "total": len(unified_records),
            "created": created_count,
            "skipped": skipped_count,
            "errors": errors
        }