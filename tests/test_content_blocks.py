"""内容块 JSON 解析 + 混合路由测试"""

import json
import pytest
from app.services.chat_service import ChatService


class TestParseContentBlocks:
    def test_valid_json_blocks(self):
        raw = json.dumps([
            {"type": "heading", "level": 2, "content": "6月汇总"},
            {"type": "summary", "cards": [{"label": "支出", "value": "674元", "trend": "down"}]},
            {"type": "table", "headers": ["分类", "金额"], "rows": [["餐饮", "347元"]]},
            {"type": "text", "content": "分析说明"},
            {"type": "callout", "level": "warning", "content": "提示"},
            {"type": "divider"},
        ], ensure_ascii=False)
        blocks = ChatService._parse_content_blocks(raw)
        assert len(blocks) == 6
        assert blocks[1]["type"] == "summary"

    def test_markdown_fallback(self):
        """Markdown 文本 → 单个 text 块（回退）"""
        raw = "这是普通 Markdown 回复，不是 JSON。"
        blocks = ChatService._parse_content_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["type"] == "text"
        assert blocks[0]["content"] == raw

    def test_hybrid_routing_markdown(self):
        """纯 Markdown → has_structured=False → 走 reply_chunk"""
        raw = "好的，已记账！今天午餐35元。"
        blocks = ChatService._parse_content_blocks(raw)
        has_structured = any(b['type'] != 'text' for b in blocks)
        assert not has_structured  # 应走 Markdown 路径

    def test_hybrid_routing_json(self):
        """JSON 有结构化块 → has_structured=True → 走 content_block"""
        raw = json.dumps([
            {"type": "heading", "level": 2, "content": "汇总"},
            {"type": "table", "headers": ["分类", "金额"], "rows": [["餐饮", "347元"]]},
        ], ensure_ascii=False)
        blocks = ChatService._parse_content_blocks(raw)
        has_structured = any(b['type'] != 'text' for b in blocks)
        assert has_structured  # 应走 JSON 路径
        assert len(blocks) == 2

    def test_json_with_fence(self):
        raw = '```json\n[{"type":"text","content":"hello"}]\n```'
        blocks = ChatService._parse_content_blocks(raw)
        assert len(blocks) == 1
        assert blocks[0]["type"] == "text"

    def test_bill_list(self):
        raw = json.dumps([
            {"type": "bill_list", "bills": [
                {"date": "06-01", "category": "餐饮", "payee": "麦当劳", "amount": "-35.00"},
            ]},
        ], ensure_ascii=False)
        blocks = ChatService._parse_content_blocks(raw)
        assert blocks[0]["type"] == "bill_list"
        assert blocks[0]["bills"][0]["payee"] == "麦当劳"

    def test_sse_roundtrip(self):
        block = {"type": "text", "content": "hello\nworld"}
        frame = ChatService._sse("content_block", json.dumps(block, ensure_ascii=False))
        lines = frame.strip().split("\n")
        parts = [l[6:] for l in lines if l.startswith("data: ")]
        parsed = json.loads("\n".join(parts))
        assert parsed == block
