# app/schemas/bill.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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