# app/models/chat_session.py
"""Chat 会话持久化模型 — 替代内存 dict，支持跨重启保留对话上下文"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)

    # 用户隔离：关联到 users 表
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=True, index=True, comment="所属用户 ID（匿名会话可为空）")

    session_key = Column(String(32), unique=True, nullable=False, index=True,
                         comment="对外暴露的会话标识（12位 hex）")
    messages = Column(JSON, nullable=False, default=list,
                      comment="OpenAI 格式的消息历史 [{role, content, ...}]")
    persona = Column(String(20), nullable=True, comment="当前会话的角色风格")
    created_at = Column(DateTime, default=datetime.now, comment="会话创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="最后活跃时间")

    # 关系定义
    user = relationship("User", back_populates="chat_sessions")

    # 复合索引：加速按用户查询会话
    __table_args__ = (
        Index("ix_chat_sessions_user_updated", "user_id", "updated_at"),
    )
