# app/schemas/chat.py

from pydantic import BaseModel, Field
from typing import Optional, List


class ChatRequest(BaseModel):
    """用户发送的聊天消息"""
    message: str = Field(..., description="用户输入的自然语言消息")
    session_id: Optional[str] = Field(None, description="会话 ID，用于多轮对话上下文")
    persona: Optional[str] = Field(None, description="角色风格: buddy/cat/analyst/homie/custom，留空使用配置默认值")
    image_base64: Optional[str] = Field(None, description="账单截图的 base64 编码（用于 OCR 识别记账）")
    image_content_type: Optional[str] = Field("image/jpeg", description="图片 MIME 类型")
    confirm_mode: bool = Field(False, description="是否开启二次确认模式，创建账单时需要用户确认")


class ConfirmActionRequest(BaseModel):
    """用户对待确认操作的响应（支持批量账单 + 逐条拒绝）"""
    session_id: str = Field(..., description="会话 ID")
    action: str = Field(..., description="confirm 或 reject")
    modified_arguments: Optional[list[dict]] = Field(None, description="用户修改后的账单参数列表 [{tool_call_id, ...fields}]，仅 confirm 时有效")
    reject_ids: Optional[list[str]] = Field(None, description="要单独拒绝的 tool_call_id 列表（从批量中移除个别账单）")


class ToolCallRecord(BaseModel):
    """单次工具调用的记录，展示在响应中用于调试和透明度"""
    tool_name: str = Field(..., description="被调用的工具名称")
    arguments: dict = Field(default_factory=dict, description="工具调用参数")
    result: Optional[str] = Field(None, description="工具返回结果（截断摘要）")


class ChatResponse(BaseModel):
    """聊天回复，包含 AI 回复和可选的工具调用追踪"""
    reply: str = Field(..., description="AI 生成的自然语言回复")
    session_id: Optional[str] = Field(None, description="当前会话 ID")
    tool_calls: List[ToolCallRecord] = Field(default_factory=list, description="本轮调用的工具列表")
    done: bool = Field(True, description="是否已完成本轮对话")


# ============ 结构化内容块 ============

class ContentBlock(BaseModel):
    type: str = Field(...)


class TextBlock(ContentBlock):
    type: str = "text"
    content: str = Field(...)


class HeadingBlock(ContentBlock):
    type: str = "heading"
    level: int = Field(2, ge=1, le=3)
    content: str = Field(...)


class SummaryCardItem(BaseModel):
    label: str = Field(...)
    value: str = Field(...)
    trend: Optional[str] = Field(None)


class SummaryBlock(ContentBlock):
    type: str = "summary"
    cards: List[SummaryCardItem] = Field(...)


class TableBlock(ContentBlock):
    type: str = "table"
    headers: List[str] = Field(...)
    rows: List[List[str]] = Field(...)


class BillListItem(BaseModel):
    date: str = Field("")
    category: str = Field("")
    payee: str = Field("")
    amount: str = Field("")


class BillListBlock(ContentBlock):
    type: str = "bill_list"
    bills: List[BillListItem] = Field(...)


class CalloutBlock(ContentBlock):
    type: str = "callout"
    level: str = Field("info")
    content: str = Field(...)


class DividerBlock(ContentBlock):
    type: str = "divider"


BLOCK_CLASS_MAP: dict[str, type[ContentBlock]] = {
    "text": TextBlock,
    "heading": HeadingBlock,
    "table": TableBlock,
    "summary": SummaryBlock,
    "bill_list": BillListBlock,
    "callout": CalloutBlock,
    "divider": DividerBlock,
}
