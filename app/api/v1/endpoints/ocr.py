# app/api/v1/endpoints/ocr.py
"""OCR 端点 — 上传账单截图 / 收据照片，vision LLM 提取交易信息"""

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.services.ocr_service import OCRService
from app.utils.image_utils import validate_image, compress_if_large, to_base64
from app.schemas.ocr import OCRResponse

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/recognize", response_model=OCRResponse)
def recognize_bill(file: UploadFile = File(...)):
    """上传账单截图或收据照片，返回识别出的结构化交易数据。

    支持 PNG / JPG / WebP 格式，最大 10MB。
    识别结果包含：交易日期、金额、商户、分类建议等。
    可在确认后逐条创建为账单记录。
    """
    # API Key 检查
    from app.config import settings
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY 未配置")

    # 读取并验证
    file_bytes = file.file.read()

    if not file.content_type:
        # 根据扩展名推断
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

    # 压缩大图（> 2048px）
    file_bytes = compress_if_large(file_bytes)
    image_b64 = to_base64(file_bytes)

    # 调用 vision LLM
    try:
        svc = OCRService()
        result = svc.recognize(image_b64, content_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 识别失败: {str(e)}")
