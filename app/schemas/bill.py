# app/schemas/bill.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from typing import Dict

class BillBase(BaseModel):
    amount: float
    category: str
    note: Optional[str] = None
    raw_text: Optional[str] = None
    transaction_date: Optional[datetime] = None

class BillCreate(BillBase):
    pass

class BillResponse(BillBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
        
class UnifiedBillRecord(BaseModel):
    """统一账单记录（用于微信/支付宝 CSV 解析后的标准化表示）"""
    transaction_date: datetime              # 交易时间
    transaction_type: Optional[str] = None  # 交易类型
    payee: Optional[str] = None             # 交易对方
    description: Optional[str] = None       # 商品说明
    direction: str                          # '收' / '支'
    amount_numeric: float                   # 金额（数值，支出为负）
    payment_method: Optional[str] = None    # 收/付款方式
    transaction_status: Optional[str] = None
    transaction_id: Optional[str] = None    # 平台交易单号（用于去重）
    merchant_order_id: Optional[str] = None # 商户订单号
    remark: Optional[str] = None
    source_file_type: str                   # 'wechat' 或 'alipay'
    raw_data: Optional[Dict] = None         # 原始行数据（调试用）