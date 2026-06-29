# app/schemas/bill.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
class BillBase(BaseModel):
    amount: float
    category: str = "未分类"
    category_id: Optional[int] = None
    note: Optional[str] = None
    raw_text: Optional[str] = None
    transaction_date: Optional[datetime] = None

class BillCreate(BillBase):
    direction: Optional[str] = None  # "收入" / "支出"


class BillUpdate(BaseModel):
    """可更新字段，全部可选"""
    amount: Optional[float] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    note: Optional[str] = None
    transaction_date: Optional[datetime] = None
    payee: Optional[str] = None
    description: Optional[str] = None
    direction: Optional[str] = None
    payment_method: Optional[str] = None
    remark: Optional[str] = None

class BillResponse(BillBase):
    id: int
    created_at: datetime
    direction: Optional[str] = None
    payee: Optional[str] = None
    description: Optional[str] = None
    transaction_type: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_status: Optional[str] = None
    transaction_id: Optional[str] = None
    merchant_order_id: Optional[str] = None
    remark: Optional[str] = None
    source_file_type: Optional[str] = None

    class Config:
        from_attributes = True
        
class FlexibleBillRecord(BaseModel):
    """宽松的账单记录模型，用于智能解析，所有字段均可为空"""
    transaction_date: Optional[datetime] = None
    amount: Optional[float] = None          # 金额（始终为正，收支类型由 direction 字段决定）
    direction: Optional[str] = None         # "支出"/"收入"
    payee: Optional[str] = None             # 交易对方
    description: Optional[str] = None       # 商品说明或描述
    transaction_type: Optional[str] = None  # 交易类型
    payment_method: Optional[str] = None    # 支付方式
    transaction_status: Optional[str] = None
    transaction_id: Optional[str] = None
    merchant_order_id: Optional[str] = None
    remark: Optional[str] = None
    raw_line: Optional[str] = None          # 原始行文本（用于LLM二次解析）
    source_file_type: str = "unknown"       # 'wechat' 或 'alipay'