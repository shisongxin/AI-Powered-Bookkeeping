from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Bill(Base):
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)
    note = Column(String(255), nullable=True)
    raw_text = Column(Text, nullable=True)
    transaction_date = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    
    # 可选的用户ID字段，为未来多用户预留
    # user_id = Column(Integer, ForeignKey("users.id"))