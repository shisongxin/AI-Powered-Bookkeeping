# app/core/auth.py
"""认证工具 — 密码哈希 (bcrypt) + JWT 令牌签发/验证 + 微信 openid 支持"""

from datetime import datetime, timedelta
from passlib.context import CryptContext
from typing import Optional
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


def create_wechat_token(openid: str) -> str:
    """为微信小程序用户签发 JWT token。

    使用 openid 作为 subject，便于后续识别用户类型。
    """
    payload = {
        "sub": f"wechat:{openid}",
        "openid": openid,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return pyjwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def extract_user_id_from_token(token: str) -> Optional[int]:
    """从 JWT token 中提取 user_id。

    支持两种格式：
    - 普通用户：sub 为 user_id 字符串
    - 微信用户：sub 为 "wechat:openid" 格式
    """
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub", "")

        # 微信用户格式：wechat:openid
        if sub.startswith("wechat:"):
            # 返回 None，需要根据 openid 单独查询
            return None

        return int(sub)
    except Exception:
        return None


def extract_openid_from_token(token: str) -> Optional[str]:
    """从 JWT token 中提取微信 openid（仅微信用户）。"""
    try:
        payload = decode_access_token(token)
        return payload.get("openid")
    except Exception:
        return None
