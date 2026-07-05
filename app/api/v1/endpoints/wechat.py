# app/api/v1/endpoints/wechat.py
"""微信小程序认证端点 — 登录、openid 校验"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import create_wechat_token
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/wechat", tags=["wechat"])


class WechatLoginRequest(BaseModel):
    """微信登录请求

    openid 由小程序端通过 wx.login → code2session 获取
    """
    openid: str


class WechatLoginResponse(BaseModel):
    """微信登录响应"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    is_new_user: bool


class WechatMiniProgramLoginRequest(BaseModel):
    """微信小程序登录请求

    小程序端通过 wx.login 获取 code，后端用 code 换取 openid
    """
    code: str
    appid: str = ""  # 可选，用于验证


@router.post("/login", response_model=WechatLoginResponse)
def wechat_login(data: WechatLoginRequest, db: Session = Depends(get_db)):
    """微信小程序登录 — 直接使用 openid 登录

    小程序端流程：
    1. 调用 wx.login() 获取 code
    2. 调用 code2session API 获取 openid
    3. 携带 openid 调用此接口

    如果 openid 不存在，自动创建新用户。
    """
    if not data.openid or len(data.openid) < 10:
        raise HTTPException(status_code=400, detail="无效的 openid")

    # 查找或创建用户
    user = db.query(User).filter(User.openid == data.openid).first()
    is_new_user = False

    if not user:
        # 自动创建小程序用户
        user = User(openid=data.openid, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new_user = True

    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")

    # 签发 token
    from app.config import settings
    token = create_wechat_token(data.openid)

    return WechatLoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        is_new_user=is_new_user,
    )


@router.post("/login/code", response_model=WechatLoginResponse)
def wechat_login_with_code(data: WechatMiniProgramLoginRequest, db: Session = Depends(get_db)):
    """微信小程序登录 — 使用 code 换取 openid

    服务端自动调用 code2session API 获取 openid，适合不信任客户端的场景。
    需要配置 WECHAT_APPID 和 WECHAT_SECRET。
    """
    import os
    import httpx

    appid = data.appid or os.getenv("WECHAT_APPID", "")
    secret = os.getenv("WECHAT_SECRET", "")

    if not appid or not secret:
        raise HTTPException(
            status_code=503,
            detail="微信配置未设置，请在 .env 中配置 WECHAT_APPID 和 WECHAT_SECRET"
        )

    if not data.code:
        raise HTTPException(status_code=400, detail="code 不能为空")

    # 调用微信 code2session API
    try:
        resp = httpx.get(
            "https://api.weixin.qq.com/sns/jscode2session",
            params={
                "appid": appid,
                "secret": secret,
                "js_code": data.code,
                "grant_type": "authorization_code",
            },
            timeout=10.0,
        )
        result = resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"微信 API 调用失败: {str(e)}")

    if result.get("errcode", 0) != 0:
        raise HTTPException(
            status_code=400,
            detail=f"微信登录失败: {result.get('errmsg', '未知错误')}"
        )

    openid = result.get("openid")
    if not openid:
        raise HTTPException(status_code=500, detail="获取 openid 失败")

    # 查找或创建用户
    user = db.query(User).filter(User.openid == openid).first()
    is_new_user = False

    if not user:
        user = User(openid=openid, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new_user = True

    if not user.is_active:
        raise HTTPException(status_code=403, detail="账户已被禁用")

    from app.config import settings
    token = create_wechat_token(openid)

    return WechatLoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        is_new_user=is_new_user,
    )


@router.get("/me")
def wechat_me(current_user: User = Depends(get_current_user)):
    """获取当前微信用户信息"""
    if not current_user:
        raise HTTPException(status_code=401, detail="请先登录")

    return {
        "id": current_user.id,
        "openid": current_user.openid,
        "unionid": current_user.unionid,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }
