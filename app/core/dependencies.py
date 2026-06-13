# app/core/dependencies.py
"""FastAPI 依赖注入 — 认证、数据库等可复用依赖

支持两种认证方式：
1. 传统 JWT token（Web 端）
2. 微信小程序 openid 直接认证（小程序端）
"""

from fastapi import Depends, HTTPException, Header
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
    x_wechat_openid: Optional[str] = Header(None, alias="X-Wechat-Openid", description="微信小程序 openid"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """获取当前用户，支持两种认证方式：

    方式一：JWT Token（Web 端）
    - 在 Swagger 中点击右上角 🔒 Authorize 按钮
    - 输入从 /register 或 /login 获取的 token

    方式二：微信 openid Header（小程序端）
    - 请求时携带 X-Wechat-Openid: <openid>
    - 系统自动查找或创建对应 User 记录

    未提供认证信息时返回 None（兼容未认证使用场景）。
    token 无效或用户不存在时抛出 401。
    """
    # 优先检查微信 openid（小程序端）
    if x_wechat_openid:
        return _get_or_create_wechat_user(x_wechat_openid, db)

    # 其次检查 JWT token（Web 端）
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


def _get_or_create_wechat_user(openid: str, db: Session) -> User:
    """根据微信 openid 获取用户，不存在则自动创建。

    小程序用户首次调用 API 时自动注册，无需显式注册流程。
    """
    user = db.query(User).filter(User.openid == openid).first()
    if user:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="账户已被禁用")
        return user

    # 自动创建小程序用户
    user = User(openid=openid, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_active_user(
    current_user: Optional[User] = Depends(get_current_user),
) -> User:
    """获取当前活跃用户，未认证时抛出 401。

    用于需要强制认证的端点。
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="请先登录")
    return current_user
