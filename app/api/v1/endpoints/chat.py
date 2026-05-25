# app/api/v1/endpoints/chat.py
"""AI 对话记账端点 — 集成 LLM function calling 实现自然语言查账/记账/统计"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.chat_service import ChatService
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """处理用户的自然语言记账消息，自动调用账单查询/创建/统计工具"""
    # 检查 LLM 配置
    from app.config import settings
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="LLM API Key 未配置，请在 .env 中设置 OPENAI_API_KEY 和 OPENAI_BASE_URL",
        )

    try:
        svc = ChatService(db)
        result = svc.chat(request.message, request.session_id)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服务调用失败: {str(e)}")
