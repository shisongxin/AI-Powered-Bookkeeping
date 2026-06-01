# app/utils/image_utils.py
"""图片验证和压缩工具 — OCR 上传前预处理"""

import base64
import io
from PIL import Image

MAX_SIZE = 10 * 1024 * 1024   # 10 MB
MAX_DIMENSION = 2048           # 最长边像素
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def validate_image(file_bytes: bytes, content_type: str) -> None:
    """验证图片格式和大小，不合法时抛出 ValueError"""
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"不支持的图片格式: {content_type}，仅支持 PNG/JPG/WebP")
    if len(file_bytes) > MAX_SIZE:
        raise ValueError(f"图片过大: {len(file_bytes) / 1024 / 1024:.1f}MB，最大 10MB")


def compress_if_large(file_bytes: bytes, max_dim: int = MAX_DIMENSION) -> bytes:
    """如果图片最长边超过 max_dim，等比缩放到 max_dim（保持 RGB）"""
    img = Image.open(io.BytesIO(file_bytes))
    w, h = img.size
    if max(w, h) <= max_dim:
        return file_bytes

    # 等比缩放
    scale = max_dim / max(w, h)
    new_size = (int(w * scale), int(h * scale))
    img = img.resize(new_size, Image.LANCZOS)

    # 转为 RGB（WebP/RGBA 等格式统一）
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")

    buf = io.BytesIO()
    img_format = img.format or "JPEG"
    # Pillow 可能丢失 format 信息，回退到 JPEG
    save_format = img_format if img_format in ("PNG", "JPEG", "WEBP") else "JPEG"
    img.save(buf, format=save_format, quality=85)
    return buf.getvalue()


def to_base64(file_bytes: bytes) -> str:
    """将图片字节转为 base64 字符串（不含 data: 前缀）"""
    return base64.b64encode(file_bytes).decode("utf-8")
