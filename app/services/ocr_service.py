# app/services/ocr_service.py
"""OCR 图片识别服务 — 图片 → vision LLM → 结构化交易数据"""

import json
import logging
from datetime import datetime
from openai import OpenAI

from app.config import settings
from app.schemas.ocr import OCRResponse, ExtractedItem

logger = logging.getLogger(__name__)

# 强化版 Vision LLM 的 OCR 提取 prompt，增强了多笔交易拆分和时间推理能力
OCR_SYSTEM_PROMPT = """你是一个高精度的账单/收据图像 OCR 结构化提取引擎。
请仔细扫描图片（包含微信支付、支付宝等聊天流或账单详情截图），并提取所有可见的独立交易记录。

【核心推理规则】
1. 完整的日期推理：图片中若只显示当天的时间（如 "11:46"、"17:04"）。请结合用户提供的[当前系统时间]，推导出每笔交易最合理的实际发生日期（格式必须为 YYYY-MM-DD）。
2. 多笔交易拆分：若图片中按时间流展现了多张卡片或多笔扣款（例如多个不同的商户、不同的金额），必须将其解析为 `items` 列表中的多个独立对象，绝对不能合并。
3. 收支符号：支出金额在 JSON 中必须记录为【负数】（如 -16.0），收入记录为【正数】（如 500.0）。
4. 字段规范：`payee` 提取完整的商户全称（如 "上海田律餐饮管理有限公司"），`category` 根据商户名智能归类到（餐饮/交通/购物/娱乐/医疗/居住/其他）。

请直接返回满足以下结构的 JSON 对象：
{
  "raw_text": "从图片中OCR识别到的连续、完整的原始文本块",
  "items": [
    {
      "transaction_date": "YYYY-MM-DD",
      "amount": -16.0,
      "direction": "支出",
      "payee": "商户全称",
      "description": "交易描述（如：使用零钱通支付）",
      "payment_method": "微信/支付宝/银行卡/现金",
      "category": "餐饮"
    }
  ],
  "confidence": "high"
}"""


class OCRService:
    """OCR 服务：使用 vision LLM 从账单截图/收据照片中提取结构化交易数据"""

    def __init__(self):
        # 保持 client 初始化逻辑不变
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY or "sk-placeholder",
            base_url=settings.OPENAI_BASE_URL,
        )

    def recognize(self, image_base64: str, content_type: str = "image/jpeg",
                  current_time_str: str = "") -> OCRResponse:
        """将 base64 图片发送到 vision LLM，返回结构化 OCR 结果。
        current_time_str 由 ChatService 统一时间锚点传入；为空时自动获取当前时间。
        """
        logger.info(f"开始 OCR 识别，图片大小: {len(image_base64)} bytes (base64)")

        # 使用外部传入的统一时间锚点，或回退到当前系统时间
        time_ref = current_time_str or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        user_prompt = f"请提取这张账单/收据中的所有交易信息。当前系统参考时间是: {time_ref}"

        # 构建 vision API 请求
        response = self.client.chat.completions.create(
            model=settings.VISION_MODEL,
            # 💡 开启官方原生 JSON 模式，确保 LLM 绝不返回 ```json 等废话
            response_format={"type": "json_object"}, 
            messages=[
                {"role": "system", "content": OCR_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{content_type};base64,{image_base64}",
                            },
                        },
                        {
                            "type": "text",
                            "text": user_prompt,
                        },
                    ],
                },
            ],
            max_tokens=1500,  # 适当放大 token 上限以完整承载多笔记录的 raw_text
            temperature=0.0,  # 💡 将温度调整至 0.0，获取最高的确定性和准确率
        )

        raw = response.choices[0].message.content or ""
        logger.info(f"Vision LLM 原生 JSON 响应长度: {len(raw)} 字符")

        return self._parse_response(raw)

    def _parse_response(self, raw: str) -> OCRResponse:
        """解析 vision LLM 返回的 JSON，多层容错"""
        import re as re_mod
        text = raw.strip()
        logger.info(f"Vision LLM 原始响应 ({len(text)} 字符): {text[:200]}...")

        # 1) 剥离 markdown 代码块
        m = re_mod.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if m:
            text = m.group(1).strip()
            logger.info("检测到 markdown 代码块包裹，已剥离")

        # 2) 尝试提取 JSON 对象
        json_text = text
        # 如果不是以 { 或 [ 开头，尝试提取
        if not text.startswith('{') and not text.startswith('['):
            m = re_mod.search(r'\{[\s\S]*\}', text)
            if m:
                json_text = m.group(0)
                logger.info("从文本中提取到 JSON 对象")

        # 3) 解析 JSON
        for attempt in range(3):
            try:
                data = json.loads(json_text)
                break
            except json.JSONDecodeError as e:
                logger.warning(f"JSON 解析尝试 {attempt+1}: {e}")
                if attempt == 0:
                    # 尝试修复常见问题：移除尾部逗号
                    json_text = re_mod.sub(r',\s*}', '}', json_text)
                    json_text = re_mod.sub(r',\s*]', ']', json_text)
                elif attempt == 1:
                    # 最后手段：宽松匹配
                    json_text = text.replace('\n', ' ').replace('\r', '')
                    m = re_mod.search(r'\{[\s\S]*\}', json_text)
                    json_text = m.group(0) if m else text
        else:
            logger.error(f"JSON 解析全部失败。原始响应前 500 字符: {raw[:500]}")
            return OCRResponse(
                success=False,
                raw_text=raw[:1000],
                items=[],
                confidence="low",
                message=f"JSON 解析失败（LLM 可能未返回合法 JSON），请检查 VISION_MODEL 配置",
            )

        # 4) 提取 items
        if isinstance(data, list):
            # LLM 直接返回了数组
            raw_items = data
        else:
            raw_items = data.get("items", [])

        items = []
        for item in raw_items:
            amt = item.get("amount")
            direction = item.get("direction", "支出")
            if amt is not None:
                try:
                    amt = float(amt)
                    if direction == "支出" and amt > 0:
                        amt = -amt
                    elif direction == "收入" and amt < 0:
                        amt = abs(amt)
                except (ValueError, TypeError):
                    amt = 0.0

            items.append(ExtractedItem(
                transaction_date=item.get("transaction_date"),
                amount=amt,
                direction=direction,
                payee=item.get("payee"),
                description=item.get("description"),
                payment_method=item.get("payment_method"),
                category=item.get("category"),
            ))

        return OCRResponse(
            success=True,
            raw_text=data.get("raw_text", "") if isinstance(data, dict) else "",
            items=items,
            confidence=data.get("confidence", "medium") if isinstance(data, dict) else "medium",
            message=f"Vision LLM 识别完成，提取到 {len(items)} 条记录",
        )