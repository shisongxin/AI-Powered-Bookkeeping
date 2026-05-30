# app/api/v1/endpoints/chat.py
"""AI 对话记账端点 — 集成 LLM function calling 实现自然语言查账/记账/统计"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.chat_service import ChatService
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


def _check_api_key():
    from app.config import settings
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="LLM API Key 未配置，请在 .env 中设置 OPENAI_API_KEY 和 OPENAI_BASE_URL",
        )


@router.post("/", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """非流式对话，返回完整响应（含工具调用追踪）"""
    _check_api_key()
    from app.config import settings
    try:
        svc = ChatService(db)
        persona = request.persona or settings.PERSONA or ""
        result = svc.chat(request.message, request.session_id, persona)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服务调用失败: {str(e)}")


@router.post("/stream")
def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    """流式对话（SSE），逐 token 推送回复，推送工具调用进度"""
    _check_api_key()
    from app.config import settings
    svc = ChatService(db)
    persona = request.persona or settings.PERSONA or ""
    return StreamingResponse(
        svc.chat_stream(request.message, request.session_id, persona),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )
