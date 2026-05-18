# app/models/bill.py

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Bill(Base):
    __tablename__ = "bills"
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=True)  # 冗余分类名，方便查询显示
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    note = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    transaction_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    direction = Column(String, nullable=True)
    payee = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    transaction_type = Column(String, nullable=True)
    payment_method = Column(String, nullable=True)
    transaction_status = Column(String, nullable=True)
    transaction_id = Column(String, unique=True, nullable=True)
    merchant_order_id = Column(String, nullable=True)
    remark = Column(Text, nullable=True)
    source_file_type = Column(String, nullable=True)

    category_rel = relationship("Category", backref="bills")