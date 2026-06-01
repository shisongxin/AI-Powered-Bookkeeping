# app/schemas/ocr.py
"""OCR 图片识别相关 Pydantic 模型"""

from pydantic import BaseModel, Field
from typing import Optional, List


class ExtractedItem(BaseModel):
    """从图片中提取的单条交易记录"""
    transaction_date: Optional[str] = Field(None, description="交易日期，格式 YYYY-MM-DD")
    amount: Optional[float] = Field(None, description="金额（支出为负，收入为正）")
    direction: Optional[str] = Field(None, description="收支方向: 支出/收入")
    payee: Optional[str] = Field(None, description="交易对方（商户名）")
    description: Optional[str] = Field(None, description="商品/交易描述")
    payment_method: Optional[str] = Field(None, description="支付方式")
    category: Optional[str] = Field(None, description="建议分类名")


class OCRResponse(BaseModel):
    """OCR 识别结果"""
    success: bool = Field(True, description="是否识别成功")
    raw_text: str = Field("", description="图片中识别到的原始文本")
    items: List[ExtractedItem] = Field(default_factory=list, description="提取的交易记录")
    confidence: str = Field("medium", description="置信度: high/medium/low")
    message: str = Field("", description="附加说明")
