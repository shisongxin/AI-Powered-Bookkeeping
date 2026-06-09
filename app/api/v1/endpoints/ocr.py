# app/api/v1/endpoints/ocr.py
"""OCR 端点 — 上传账单截图，PaddleOCR 本地识别 + vision LLM 兜底"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File

from app.utils.image_utils import validate_image, compress_if_large, to_base64
from app.schemas.ocr import OCRResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/recognize", response_model=OCRResponse)
def recognize_bill(file: UploadFile = File(...)):
    """上传账单截图或收据照片，返回识别出的结构化交易数据。

    优先使用 PaddleOCR 本地引擎（免费、精准、无 API 调用延迟），
    PaddleOCR 不可用时回退到 vision LLM。

    支持 PNG / JPG / WebP 格式，最大 10MB。
    """
    # 读取并验证
    file_bytes = file.file.read()

    if not file.content_type:
        filename = (file.filename or "").lower()
        if filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith(".webp"):
            content_type = "image/webp"
        else:
            content_type = "image/jpeg"
    else:
        content_type = file.content_type

    try:
        validate_image(file_bytes, content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    file_bytes = compress_if_large(file_bytes)

    # ---- 主路径：PaddleOCR ----
    try:
        from app.services.paddle_ocr_service import PaddleOCRService
        svc = PaddleOCRService()
        text_lines = svc.recognize_from_bytes(file_bytes)
        if text_lines:
            result = svc.extract_transactions(text_lines)
            if result.success and result.items:
                logger.info(f"PaddleOCR 成功提取 {len(result.items)} 条记录")
                return result
            logger.info("PaddleOCR 未提取到交易，回退 vision LLM")
        else:
            logger.info("PaddleOCR 未检测到文本，回退 vision LLM")
    except (ImportError, Exception) as e:
        logger.warning(f"PaddleOCR 不可用 ({e})，回退 vision LLM")

    # ---- 回退路径：Vision LLM ----
    from app.config import settings
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="PaddleOCR 不可用且 OPENAI_API_KEY 未配置")

    try:
        from app.services.ocr_service import OCRService
        image_b64 = to_base64(file_bytes)
        svc = OCRService()
        result = svc.recognize(image_b64, content_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 识别失败: {str(e)}")
