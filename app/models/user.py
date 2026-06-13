# app/models/user.py
"""用户模型 — 认证与多用户数据隔离

支持两种认证方式：
1. 传统用户名+密码认证（Web 端）
2. 微信小程序 openid 认证（小程序端）
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # 微信开放平台标识（小程序用户唯一标识，28位字符串）
    openid = Column(String(64), unique=True, nullable=True, index=True,
                    comment="微信 openid，小程序用户唯一标识")
    # 微信开放平台跨应用唯一标识（同一用户在不同小程序/公众号下的唯一标识）
    unionid = Column(String(64), unique=True, nullable=True, index=True,
                     comment="微信 unionid，跨应用唯一标识")

    # 传统 Web 端认证字段（保留向后兼容）
    username = Column(String(50), unique=True, nullable=True, index=True,
                      comment="用户名（Web 端），小程序用户可为空")
    password_hash = Column(String(128), nullable=True, comment="bcrypt 哈希（Web 端）")
    email = Column(String(100), unique=True, nullable=True)

    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime, default=datetime.now)

    # 多租户关系：一个用户拥有多个账单、分类、预算、会话
    bills = relationship("Bill", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

    # 复合索引：加速 openid 查询
    __table_args__ = (
        Index("ix_users_openid_is_active", "openid", "is_active"),
    )
