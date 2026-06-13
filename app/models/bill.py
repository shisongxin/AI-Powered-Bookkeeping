# app/models/bill.py

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Bill(Base):
    __tablename__ = "bills"
    id = Column(Integer, primary_key=True, index=True)

    # 用户隔离：关联到 users 表的 openid
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True, comment="所属用户 ID")

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

    # 关系定义
    category_rel = relationship("Category", backref="bills")
    user = relationship("User", back_populates="bills")

    # 复合索引：加速按用户+日期查询
    __table_args__ = (
        Index("ix_bills_user_transaction_date", "user_id", "transaction_date"),
    )