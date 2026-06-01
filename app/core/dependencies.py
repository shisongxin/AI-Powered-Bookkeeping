# app/core/dependencies.py
"""FastAPI 依赖注入 — 认证、数据库等可复用依赖"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.auth import decode_access_token
from app.models.user import User

# 在 Swagger 中显示 🔒 Authorize 按钮，用户可粘贴 Bearer token
# auto_error=False 使 token 可选（兼容未认证使用场景）
security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """从 Authorization 头提取 JWT token 并返回当前用户。
    未提供 token 时返回 None（兼容未认证使用场景）。
    token 无效或用户不存在时抛出 401。

    使用方法：
    1. 在 Swagger 中点击右上角 🔒 Authorize 按钮
    2. 输入从 /register 或 /login 获取的 token（直接粘贴，无需 Bearer 前缀）
    3. 再调用 /me 即可
    """
    if not credentials:
        return None

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="认证令牌无效或已过期")

    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")

    return user
