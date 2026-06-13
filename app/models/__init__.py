# app/models/__init__.py
"""模型包 — 导入所有模型，确保 SQLAlchemy 关系正确解析"""

from app.models.user import User  # noqa: F401
from app.models.bill import Bill  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.budget import Budget  # noqa: F401
from app.models.chat_session import ChatSession  # noqa: F401

__all__ = ["User", "Bill", "Category", "Budget", "ChatSession"]
