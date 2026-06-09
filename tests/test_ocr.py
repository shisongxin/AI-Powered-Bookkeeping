# tests/test_ocr.py
"""OCR 图片识别测试 — image_utils + OCRService + 端点"""

import sys
import os
# 将项目根目录添加到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path

import io
import json
import pytest
from unittest.mock import patch, MagicMock
from PIL import Image

from app.utils.image_utils import validate_image, compress_if_large, to_base64
from app.schemas.ocr import OCRResponse, ExtractedItem


# ---------- 辅助：生成测试图片 ----------

def _make_test_image(width=800, height=600, fmt="JPEG") -> bytes:
    """生成一张简单测试图片"""
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# ========== 1. image_utils 测试 ==========

class TestImageUtils:
    def test_validate_png(self):
        img = _make_test_image(fmt="PNG")
        validate_image(img, "image/png")  # 不应抛异常

    def test_validate_jpeg(self):
        img = _make_test_image(fmt="JPEG")
        validate_image(img, "image/jpeg")

    def test_validate_unsupported_format(self):
        with pytest.raises(ValueError, match="不支持"):
            validate_image(b"fake", "image/gif")

    def test_compress_large_image(self):
        img = _make_test_image(width=3000, height=2000)
        compressed = compress_if_large(img)
        assert len(compressed) < len(img)  # 压缩后应更小

    def test_compress_small_image_unchanged(self):
        img = _make_test_image(width=200, height=100)
        result = compress_if_large(img)
        assert result == img  # 小图不压缩

    def test_to_base64(self):
        data = b"test_image_data"
        b64 = to_base64(data)
        assert isinstance(b64, str)
        import base64
        assert base64.b64decode(b64) == data


# ========== 2. OCRService 测试（mock vision LLM） ==========

class TestOCRService:
    def test_recognize_success(self):
        """Mock vision LLM 返回有效 JSON"""
        from app.services.ocr_service import OCRService

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps({
            "raw_text": "麦当劳 午餐 35元",
            "items": [
                {
                    "transaction_date": "2026-05-25",
                    "amount": -35.0,
                    "direction": "支出",
                    "payee": "麦当劳",
                    "description": "午餐",
                    "payment_method": "微信",
                    "category": "餐饮",
                }
            ],
            "confidence": "high",
        }, ensure_ascii=False)

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        svc = OCRService()
        svc.client = mock_client

        result = svc.recognize("base64data", "image/jpeg")
        assert result.success is True
        assert len(result.items) == 1
        assert result.items[0].payee == "麦当劳"
        assert result.items[0].amount == -35.0
        assert result.confidence == "high"

    def test_recognize_empty_receipt(self):
        """图片中无交易信息"""
        from app.services.ocr_service import OCRService

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps({
            "raw_text": "",
            "items": [],
            "confidence": "low",
        }, ensure_ascii=False)

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        svc = OCRService()
        svc.client = mock_client

        result = svc.recognize("base64data")
        assert result.success is True
        assert len(result.items) == 0
        assert result.confidence == "low"

    def test_recognize_parse_failure(self):
        """LLM 返回非法 JSON 时优雅降级"""
        from app.services.ocr_service import OCRService

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "抱歉，这不是一张有效的账单图片"

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        svc = OCRService()
        svc.client = mock_client

        result = svc.recognize("base64data")
        assert result.success is False
        assert len(result.items) == 0
        assert "抱歉" in result.raw_text

    def test_recognize_markdown_wrapped_json(self):
        """LLM 返回 ```json ... ``` 包裹的 JSON"""
        from app.services.ocr_service import OCRService

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = """```json
{"raw_text": "test", "items": [], "confidence": "medium"}
```"""

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        svc = OCRService()
        svc.client = mock_client

        result = svc.recognize("base64data")
        assert result.success is True


# ========== 3. OCR API 端点测试 ==========

class TestOCRAPI:
    def test_recognize_endpoint_mock(self, api):
        """PaddleOCR 不可用时回退到 vision LLM"""
        import app.config
        from app.services import ocr_service as vision_ocr_module

        mock_vision = MagicMock()
        mock_vision.recognize.return_value = OCRResponse(
            success=True,
            raw_text="测试文本",
            items=[ExtractedItem(payee="星巴克", amount=-30.0, direction="支出")],
            confidence="high",
            message="识别完成",
        )

        img = _make_test_image()
        with patch.object(app.config.settings, "OPENAI_API_KEY", "sk-test"), \
             patch("app.services.paddle_ocr_service.PaddleOCRService") as mock_paddle, \
             patch.object(vision_ocr_module, "OCRService", return_value=mock_vision):
            # 模拟 PaddleOCR 不可用（ImportError）
            mock_paddle.side_effect = ImportError("PaddleOCR not installed")
            resp = api.post("/api/v1/ocr/recognize", files={"file": ("test.jpg", img, "image/jpeg")})
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert len(data["items"]) == 1
            assert data["items"][0]["payee"] == "星巴克"

    def test_recognize_invalid_format(self, api):
        """不支持的图片格式返回 400"""
        import app.config
        with patch.object(app.config.settings, "OPENAI_API_KEY", "sk-test"):
            resp = api.post("/api/v1/ocr/recognize", files={"file": ("test.gif", b"GIF89a", "image/gif")})
            assert resp.status_code == 400

    def test_missing_api_key(self, api):
        """未配置 API Key 返回 500"""
        import app.config
        with patch.object(app.config.settings, "OPENAI_API_KEY", ""):
            resp = api.post("/api/v1/ocr/recognize", files={"file": ("test.jpg", _make_test_image(), "image/jpeg")})
            assert resp.status_code == 500


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
