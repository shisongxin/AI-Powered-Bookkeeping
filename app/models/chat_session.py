# app/models/chat_session.py
"""Chat 会话持久化模型 — 替代内存 dict，支持跨重启保留对话上下文"""

from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime

from app.core.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_key = Column(String(32), unique=True, nullable=False, index=True,
                         comment="对外暴露的会话标识（12位 hex）")
    messages = Column(JSON, nullable=False, default=list,
                      comment="OpenAI 格式的消息历史 [{role, content, ...}]")
    persona = Column(String(20), nullable=True, comment="当前会话的角色风格")
    created_at = Column(DateTime, default=datetime.now, comment="会话创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="最后活跃时间")
