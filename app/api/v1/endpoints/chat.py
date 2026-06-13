# app/api/v1/endpoints/chat.py
"""AI 对话记账端点 — 集成 LLM function calling 实现自然语言查账/记账/统计"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.services.chat_service import ChatService
from app.schemas.chat import ChatRequest, ChatResponse, ConfirmActionRequest

router = APIRouter(prefix="/chat", tags=["chat"])


def _check_api_key():
    from app.config import settings
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="LLM API Key 未配置，请在 .env 中设置 OPENAI_API_KEY 和 OPENAI_BASE_URL",
        )


@router.post("/", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """非流式对话，返回完整响应（含工具调用追踪）"""
    _check_api_key()
    from app.config import settings
    try:
        svc = ChatService(
            db,
            image_base64=request.image_base64 or "",
            image_content_type=request.image_content_type or "image/jpeg",
            confirm_mode=request.confirm_mode,
        )
        persona = request.persona or settings.PERSONA or ""
        result = svc.chat(request.message, request.session_id, persona, user_id=current_user.id)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服务调用失败: {str(e)}")


@router.post("/stream")
def chat_stream(request: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """流式对话（SSE），逐 token 推送回复，推送工具调用进度。
    当 confirm_mode=True 时，create_bill 操作会暂停等待用户二次确认。"""
    _check_api_key()
    from app.config import settings
    svc = ChatService(
        db,
        image_base64=request.image_base64 or "",
        image_content_type=request.image_content_type or "image/jpeg",
        confirm_mode=request.confirm_mode,
    )
    persona = request.persona or settings.PERSONA or ""
    return StreamingResponse(
        svc.chat_stream(request.message, request.session_id, persona, user_id=current_user.id),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@router.post("/confirm")
def confirm_action(request: ConfirmActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """确认或取消待处理的 create_bill 操作（需配合 confirm_mode=True 使用）。
    当 AI 在确认模式下发起记账请求后，用户可通过此端点确认或拒绝。"""
    _check_api_key()
    svc = ChatService(db, confirm_mode=True)
    return StreamingResponse(
        svc.resume_after_confirmation(
            request.session_id,
            request.action,
            request.modified_arguments,
            request.reject_ids,
            user_id=current_user.id,
        ),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )
