# tests/test_chat.py
"""AI 对话记账测试 — ToolExecutor 直测 + ChatService/API mock 测试"""

import json
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from app.models.bill import Bill
from app.models.category import Category
from app.services.chat_service import ChatService, ToolExecutor, _sessions, _get_or_create_session
from app.schemas.chat import ChatRequest, ChatResponse


# ---------- 种子数据 ----------

def seed_for_chat(db):
    """为聊天测试准备基础数据：分类 + 少量账单"""
    cats = [
        Category(name="餐饮", keywords="外卖,餐厅,火锅"),
        Category(name="交通", keywords="地铁,打车"),
        Category(name="购物", keywords="淘宝,京东"),
        Category(name="收入", keywords="工资,奖金"),
    ]
    for c in cats:
        db.add(c)
    db.commit()

    bills = [
        Bill(amount=-35.0, category="餐饮", direction="支出",
             payee="麦当劳", description="午餐", payment_method="微信",
             transaction_date=datetime(2026, 5, 15, 12, 30)),
        Bill(amount=-200.0, category="交通", direction="支出",
             payee="滴滴出行", description="打车回家",
             transaction_date=datetime(2026, 5, 15, 18, 0)),
        Bill(amount=5000.0, category="收入", direction="收入",
             payee="公司", description="5月工资",
             transaction_date=datetime(2026, 5, 1, 10, 0)),
    ]
    for b in bills:
        db.add(b)
    db.commit()


# ---------- 辅助函数：创建 mock OpenAI client ----------

def _make_mock_openai(*responses: list[dict]):
    """创建 mock OpenAI client，按顺序返回指定的 chat completion 响应。

    每个 responses 元素是一个完整的 choices[0].message 内容，格式：
    {"content": "回复文本"} 或 {"tool_calls": [...]}
    """
    mock_client = MagicMock()
    mock_completions = MagicMock()

    mock_messages = []
    for r in responses:
        mock_msg = MagicMock()
        if "tool_calls" in r:
            # 构造 mock tool_calls
            mock_tcs = []
            for tc_data in r["tool_calls"]:
                mock_tc = MagicMock()
                mock_tc.id = tc_data["id"]
                mock_tc.type = "function"
                mock_func = MagicMock()
                mock_func.name = tc_data["function"]["name"]
                mock_func.arguments = tc_data["function"]["arguments"]
                mock_tc.function = mock_func
                mock_tcs.append(mock_tc)
            mock_msg.tool_calls = mock_tcs
            mock_msg.content = r.get("content", "")
        else:
            mock_msg.tool_calls = None
            mock_msg.content = r.get("content", "")
        mock_messages.append(mock_msg)

    mock_choice = MagicMock()
    mock_choice.message = mock_messages[0] if len(mock_messages) == 1 else mock_messages

    # 如果只有一个 response，直接返回；否则通过 side_effect 顺序返回
    if len(responses) == 1:
        mock_resp = MagicMock()
        mock_resp.choices = [mock_choice]
        mock_completions.create.return_value = mock_resp
    else:
        mock_resps = []
        for mock_msg in mock_messages:
            mock_resp = MagicMock()
            mock_choice = MagicMock()
            mock_choice.message = mock_msg
            mock_resp.choices = [mock_choice]
            mock_resps.append(mock_resp)
        mock_completions.create.side_effect = mock_resps

    mock_client.chat.completions = mock_completions
    return mock_client


# ========== 1. ToolExecutor 工具执行器测试（不依赖 LLM） ==========

class TestToolExecutor:
    def test_list_categories(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._list_categories())
        assert len(result) >= 4
        names = [c["name"] for c in result]
        assert "餐饮" in names
        assert "交通" in names
        assert "收入" in names

    def test_query_bills_all(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._query_bills({}))
        assert result["count"] == 3

    def test_query_bills_filter_category(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._query_bills({"category": "餐饮"}))
        assert result["count"] == 1
        assert result["bills"][0]["payee"] == "麦当劳"

    def test_query_bills_filter_direction(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._query_bills({"direction": "收入"}))
        assert result["count"] == 1
        assert result["bills"][0]["amount"] == 5000.0

    def test_query_bills_filter_date_range(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._query_bills({
            "start_date": "2026-05-01",
            "end_date": "2026-05-01",
        }))
        assert result["count"] == 1
        assert result["bills"][0]["category"] == "收入"

    def test_create_bill(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._create_bill({
            "amount": -50.0,
            "direction": "支出",
            "category": "餐饮",
            "payee": "星巴克",
            "description": "咖啡",
            "transaction_date": "2026-05-20",
            "payment_method": "微信",
        }))
        assert result["success"] is True
        assert result["bill"]["amount"] == -50.0
        assert result["bill"]["category"] == "餐饮"
        assert result["bill"]["id"] is not None

    def test_get_monthly_summary(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._get_monthly_summary({"year": 2026, "month": 5}))
        assert result["income"] == 5000.0
        assert result["expense"] == 235.0
        assert result["net"] == 4765.0
        assert result["transaction_count"] == 3

    def test_get_category_breakdown(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._get_category_breakdown({
            "start_date": "2026-05-01",
            "end_date": "2026-05-31",
            "direction": "支出",
        }))
        assert len(result) >= 2
        cats = {r["category"]: r for r in result}
        assert cats["交通"]["amount"] == 200.0
        assert cats["餐饮"]["amount"] == 35.0

    def test_get_trend_monthly(self, db):
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = json.loads(executor._get_trend({
            "start_date": "2026-05-01",
            "end_date": "2026-06-30",
            "granularity": "monthly",
        }))
        assert len(result) >= 1
        assert result[0]["period"] == "2026-05"
        assert result[0]["income"] == 5000.0

    def test_execute_dispatch(self, db):
        """测试 execute 方法的路由分发"""
        seed_for_chat(db)
        executor = ToolExecutor(db)
        result = executor.execute("list_categories", {})
        data = json.loads(result)
        assert isinstance(data, list)
        assert len(data) >= 4


# ========== 2. ChatService 对话循环测试（mock LLM） ==========

class TestChatService:
    def test_direct_reply_no_tool(self, db):
        """LLM 直接回复，不需要调用工具"""
        seed_for_chat(db)
        svc = ChatService(db)
        svc.client = _make_mock_openai({"content": "你好！有什么可以帮你的？"})

        result = svc.chat("你好")
        assert result["done"] is True
        assert "你好" in result["reply"]
        assert result["tool_calls"] == []
        assert result["session_id"] is not None

    def test_single_tool_call_flow(self, db):
        """LLM 调用一个工具后生成回复"""
        seed_for_chat(db)
        svc = ChatService(db)
        svc.client = _make_mock_openai(
            # 第一次：LLM 决定调用 list_categories
            {
                "content": "",
                "tool_calls": [{
                    "id": "call_001",
                    "function": {
                        "name": "list_categories",
                        "arguments": json.dumps({}),
                    },
                }],
            },
            # 第二次：LLM 收到工具结果后生成最终回复
            {"content": "当前有以下分类：餐饮、交通、购物、收入。请问你想记录哪一笔？"},
        )

        result = svc.chat("有哪些分类")
        assert result["done"] is True
        assert "分类" in result["reply"]
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["tool_name"] == "list_categories"

    def test_multi_tool_call_flow(self, db):
        """LLM 在一轮中调用多个工具"""
        seed_for_chat(db)
        svc = ChatService(db)
        svc.client = _make_mock_openai(
            # 第一次：LLM 同时调用月度汇总和分类分布
            {
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_001",
                        "function": {
                            "name": "get_monthly_summary",
                            "arguments": json.dumps({"year": 2026, "month": 5}),
                        },
                    },
                    {
                        "id": "call_002",
                        "function": {
                            "name": "get_category_breakdown",
                            "arguments": json.dumps({
                                "start_date": "2026-05-01",
                                "end_date": "2026-05-31",
                                "direction": "支出",
                            }),
                        },
                    },
                ],
            },
            # 第二次：LLM 收到两个工具结果后生成最终回复
            {"content": "2026年5月总收入5000元，总支出235元。支出中交通200元占85%，餐饮35元占15%。"},
        )

        result = svc.chat("这个月花了多少")
        assert result["done"] is True
        assert "5000" in result["reply"]
        assert len(result["tool_calls"]) == 2
        tool_names = {tc["tool_name"] for tc in result["tool_calls"]}
        assert tool_names == {"get_monthly_summary", "get_category_breakdown"}


# ========== 3. Chat API 端点测试（mock LLM） ==========

class TestChatAPI:
    def test_missing_api_key(self, api):
        """未配置 API Key 时返回 500"""
        resp = api.post("/api/v1/chat/", json={"message": "你好"})
        # OPENAI_API_KEY 默认为空（测试环境），端点会拒绝
        assert resp.status_code == 500

    def test_chat_success(self, api):
        """Mock ChatService 返回成功响应 — 模拟完整 tool call 流程"""
        import app.config
        import app.api.v1.endpoints.chat as chat_module

        mock_svc = MagicMock()
        mock_svc.chat.return_value = {
            "reply": "已为您记录一笔餐饮支出35元。",
            "session_id": "abc123",
            "tool_calls": [
                {"tool_name": "create_bill", "arguments": {"amount": -35.0}, "result": "..."}
            ],
            "done": True,
        }

        with patch.object(app.config.settings, "OPENAI_API_KEY", "sk-test-key"), \
             patch.object(chat_module, "ChatService", return_value=mock_svc):
            resp = api.post("/api/v1/chat/", json={"message": "午餐花了35元"})
            assert resp.status_code == 200
            data = resp.json()
            assert "记录" in data["reply"]
            assert data["session_id"] == "abc123"
            assert len(data["tool_calls"]) == 1
            assert data["tool_calls"][0]["tool_name"] == "create_bill"


# ========== 4. 会话管理测试 ==========

class TestSessionManagement:
    def test_new_session_created(self, db):
        """新对话自动创建 session_id"""
        seed_for_chat(db)
        svc = ChatService(db)
        svc.client = _make_mock_openai({"content": "您好"})

        result = svc.chat("测试")
        assert result["session_id"] is not None
        assert len(result["session_id"]) == 12

    def test_session_reuse(self, db):
        """多轮对话复用同一 session_id"""
        seed_for_chat(db)
        svc = ChatService(db)
        svc.client = _make_mock_openai(
            {"content": "已记录。"},
        )

        result1 = svc.chat("午餐35元")
        sid = result1["session_id"]

        result2 = svc.chat("晚餐80元", session_id=sid)
        assert result2["session_id"] == sid

        # 验证历史记录中有 2 轮 user+assistant
        assert sid in _sessions
        history = _sessions[sid]
        user_msgs = [m for m in history if m["role"] == "user"]
        assert len(user_msgs) == 2

    def test_standalone_session_helper(self):
        """测试 _get_or_create_session 辅助函数"""
        # 清除可能残留的会话
        _sessions.clear()

        sid, hist = _get_or_create_session(None)
        assert len(sid) == 12
        assert hist == []

        sid2, hist2 = _get_or_create_session(sid)
        assert sid2 == sid
        assert hist2 is hist  # 同一对象引用


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
