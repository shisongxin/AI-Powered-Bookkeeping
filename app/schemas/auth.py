# app/schemas/auth.py
"""认证相关 Pydantic 模型"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class RegisterRequest(BaseModel):
    """用户注册请求"""
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    password: str = Field(..., min_length=4, max_length=72, description="密码（4-72字符）")
    email: Optional[str] = Field(None, max_length=100, description="邮箱（可选）")


class LoginRequest(BaseModel):
    """用户登录请求"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class TokenResponse(BaseModel):
    """JWT 令牌响应"""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="令牌类型")
    expires_in: int = Field(..., description="有效期（秒）")


class UserResponse(BaseModel):
    """用户信息响应"""
    id: int
    username: str
    email: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
