# app/api/v1/endpoints/chat.py
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
async def chat(request: ChatRequest):
    # TODO: 后续集成 RAG 逻辑
    return {"response": f"您说: {request.message}"}