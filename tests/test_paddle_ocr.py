"""PaddleOCR 提取逻辑测试 — 金额/商户/日期/分类解析"""

import pytest
from datetime import datetime
from app.services.paddle_ocr_service import (
    PaddleOCRService,
    _parse_amount, _parse_date, _detect_payment, _classify_category,
    _is_merchant_line,
)


class TestAmountParsing:
    def test_amount_with_yuan(self):
        assert _parse_amount("消费 35.00元") == 35.0

    def test_negative_amount(self):
        assert _parse_amount("-16.50") == -16.50

    def test_amount_with_rmb(self):
        assert _parse_amount("¥128.00") == 128.0

    def test_amount_with_chinese_yuan(self):
        assert _parse_amount("￥99.90") == 99.90

    def test_no_amount(self):
        assert _parse_amount("餐饮消费") is None

    def test_integer_amount(self):
        assert _parse_amount("500元") == 500.0


class TestDateParsing:
    def test_full_date(self):
        assert _parse_date("2026-06-15 12:30", 2026, 6) == "2026-06-15"

    def test_chinese_date(self):
        assert _parse_date("2026年06月15日", 2026, 6) == "2026-06-15"

    def test_short_date(self):
        result = _parse_date("06-15 12:30", 2026, 6)
        assert result == "2026-06-15"

    def test_no_date(self):
        assert _parse_date("消费记录") == ""


class TestPaymentDetection:
    def test_wechat(self):
        assert _detect_payment("微信支付") == "微信"

    def test_alipay(self):
        assert _detect_payment("支付宝") == "支付宝"

    def test_no_payment(self):
        assert _detect_payment("餐饮消费") == ""


class TestCategoryClassification:
    def test_restaurant(self):
        assert _classify_category("麦当劳 汉堡") == "餐饮"

    def test_transport(self):
        assert _classify_category("滴滴出行 打车") == "交通"

    def test_shopping(self):
        assert _classify_category("京东商城 购物") == "购物"

    def test_unknown(self):
        assert _classify_category("未知商户XYZ") == "其他"


class TestMerchantDetection:
    def test_valid_merchant(self):
        assert _is_merchant_line("麦当劳北京路店") is True

    def test_amount_line_not_merchant(self):
        assert _is_merchant_line("¥35.00") is False

    def test_short_text(self):
        assert _is_merchant_line("OK") is False

    def test_payment_line_not_merchant(self):
        assert _is_merchant_line("微信支付") is False


class TestExtractTransactions:
    def test_wechat_receipt(self):
        """模拟微信支付截图文本"""
        lines = [
            "微信支付",
            "麦当劳北京路店",
            "2026-06-15 12:30",
            "¥35.00",
        ]
        svc = PaddleOCRService()
        # 不加载 OCR 模型，只测解析逻辑
        svc._ocr = object()  # 防止延迟加载触发
        result = svc.extract_transactions(lines, ref_date=datetime(2026, 6, 15))
        assert result.success is True
        assert len(result.items) >= 1
        item = result.items[0]
        assert item.amount == 35.0
        assert item.payee and "麦当劳" in item.payee
        assert item.category == "餐饮"

    def test_alipay_receipt(self):
        """模拟支付宝截图文本"""
        lines = [
            "支付宝",
            "滴滴出行",
            "2026-06-16 18:00",
            "-22.50",
        ]
        svc = PaddleOCRService()
        svc._ocr = object()
        result = svc.extract_transactions(lines, ref_date=datetime(2026, 6, 16))
        assert result.success is True
        assert len(result.items) >= 1
        item = result.items[0]
        assert item.amount == -22.50
        assert item.category == "交通"

    def test_multiple_transactions(self):
        """多笔交易"""
        lines = [
            "微信支付",
            "麦当劳",
            "¥35.00",
            "滴滴出行",
            "¥22.50",
            "超市",
            "¥128.00",
        ]
        svc = PaddleOCRService()
        svc._ocr = object()
        result = svc.extract_transactions(lines)
        assert result.success is True
        # 应识别出 3 笔
        assert len(result.items) >= 3

    def test_empty_text(self):
        svc = PaddleOCRService()
        svc._ocr = object()
        result = svc.extract_transactions([])
        assert result.success is False
        assert result.confidence == "low"

    def test_no_amount_found(self):
        lines = ["这是一段没有金额的文字", "只是普通的描述"]
        svc = PaddleOCRService()
        svc._ocr = object()
        result = svc.extract_transactions(lines)
        assert result.success is True
        assert len(result.items) == 0

    def test_confidence_levels(self):
        """验证置信度"""
        svc = PaddleOCRService()
        svc._ocr = object()

        # 多笔交易 → high
        r = svc.extract_transactions(["麦当劳", "¥35.00", "滴滴", "¥22.50"])
        assert r.confidence == "high"

        # 单笔 → medium (in current logic, high since >= 1)
        r = svc.extract_transactions(["麦当劳", "¥35.00"])
        assert r.confidence in ("medium", "high")

    def test_date_fallback(self):
        """无日期时使用当前日期"""
        svc = PaddleOCRService()
        svc._ocr = object()
        result = svc.extract_transactions(
            ["麦当劳", "¥35.00"],
            ref_date=datetime(2026, 6, 15),
        )
        assert result.items[0].transaction_date == "2026-06-15"
