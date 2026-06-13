# app/models/category.py

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment="所属用户 ID")
    name = Column(String(50), nullable=False)
    icon = Column(String(10), nullable=True)
    color = Column(String(20), nullable=True)
    keywords = Column(Text, nullable=True)  # 逗号分隔的关键词，用于自动匹配
    created_at = Column(DateTime, default=datetime.now)

    # 关系
    user = relationship("User", back_populates="categories")
