# app/core/auth.py
"""认证工具 — 密码哈希 (bcrypt) + JWT 令牌签发/验证"""

from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt as pyjwt

from app.config import settings

# bcrypt 密码上下文
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """对明文密码做 bcrypt 哈希"""
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """验证明文密码是否匹配哈希"""
    return _pwd_ctx.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    """签发 JWT access token，有效期由 JWT_EXPIRE_MINUTES 配置"""
    payload = {
        "sub": str(user_id),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return pyjwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """解码并验证 JWT token，返回 payload；无效则抛出异常"""
    return pyjwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
