# tests/test_chat.py
"""AI 对话记账测试 — ToolExecutor 直测 + ChatService/API mock 测试"""

import json
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from app.models.bill import Bill
from app.models.category import Category
from app.models.chat_session import ChatSession
from app.services.chat_service import ChatService, ToolExecutor, _prune_history
from app.services.chat_session_service import ChatSessionService
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
        assert result["status"] == "success"
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
        import app.config
        with patch.object(app.config.settings, "OPENAI_API_KEY", ""):
            resp = api.post("/api/v1/chat/", json={"message": "你好"})
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
        """多轮对话复用同一 session_id，且持久化到 DB"""
        seed_for_chat(db)
        svc = ChatService(db)
        svc.client = _make_mock_openai({"content": "已记录。"})

        result1 = svc.chat("午餐35元")
        sid = result1["session_id"]

        result2 = svc.chat("晚餐80元", session_id=sid)
        assert result2["session_id"] == sid

        # 验证 DB 中有该会话
        session = db.query(ChatSession).filter(ChatSession.session_key == sid).first()
        assert session is not None
        # 验证 history 包含 2 轮 user 消息
        user_msgs = [m for m in session.messages if m.get("role") == "user"]
        assert len(user_msgs) == 2

    def test_session_persisted_across_instances(self, db):
        """不同 ChatService 实例使用同一 session_id 能恢复上下文"""
        seed_for_chat(db)
        # 第一个实例创建会话
        svc1 = ChatService(db)
        svc1.client = _make_mock_openai({"content": "你好！"})
        result1 = svc1.chat("你好")
        sid = result1["session_id"]

        # 第二个实例使用同一 session_id
        svc2 = ChatService(db)
        svc2.client = _make_mock_openai({"content": "这是第二轮的回复"})
        result2 = svc2.chat("继续", session_id=sid)
        assert result2["session_id"] == sid

    def test_session_service_get_or_create(self, db):
        """ChatSessionService 基本 CRUD 操作"""
        svc = ChatSessionService(db)

        # 创建新会话
        key, hist = svc.get_or_create(None)
        assert len(key) == 12
        assert hist == []

        # 再次获取同一会话
        key2, hist2 = svc.get_or_create(key)
        assert key2 == key
        assert hist2 == hist

        # 保存消息
        svc.save(key, [{"role": "system", "content": "test"}])
        _, loaded = svc.get_or_create(key)
        assert len(loaded) == 1
        assert loaded[0]["role"] == "system"

    def test_ttl_compress(self, db, monkeypatch):
        """会话超过 TTL 天数后自动压缩历史"""
        from datetime import timedelta
        seed_for_chat(db)

        # 设置较短 TTL 以便测试
        monkeypatch.setattr("app.services.chat_session_service.settings.CHAT_SESSION_TTL_DAYS", 0)
        monkeypatch.setattr("app.services.chat_session_service.settings.CHAT_KEEP_RECENT_ROUNDS", 2)

        chat_svc = ChatSessionService(db)
        key, _ = chat_svc.get_or_create()

        # 构造多轮对话历史（8 轮 = 16 条 user+assistant 消息 + 1 system）
        messages = [{"role": "system", "content": "System prompt"}]
        for i in range(8):
            messages.append({"role": "user", "content": f"用户消息{i}"})
            messages.append({"role": "assistant", "content": f"助手回复{i}"})

        chat_svc.save(key, messages)

        # 重新加载——TTL=0 触发压缩，只保留 system + 最近 2 轮
        _, loaded = chat_svc.get_or_create(key)
        assert len(loaded) < len(messages), f"压缩后应少于原始消息数: {len(loaded)} vs {len(messages)}"
        assert loaded[0]["role"] == "system"  # system prompt 还在
        user_msgs = [m for m in loaded if m.get("role") == "user"]
        assert len(user_msgs) <= 2  # 只保留最近 2 轮

    def test_prune_history_helper(self):
        """_prune_history 辅助函数修剪对话历史"""
        messages = [{"role": "system", "content": "System prompt"}]
        for i in range(15):
            messages.append({"role": "user", "content": f"u{i}"})
            messages.append({"role": "assistant", "content": f"a{i}"})

        _prune_history(messages, keep_recent=3)
        assert messages[0]["role"] == "system"
        user_msgs = [m for m in messages if m.get("role") == "user"]
        assert len(user_msgs) <= 3
        # 最后一条 user 消息应该是 u14
        assert user_msgs[-1]["content"] == "u14"


# ========== 5. Persona 角色系统测试 ==========

class TestPersona:
    def test_get_persona_prompt_buddy(self):
        from app.services.chat_service import _get_persona_prompt
        prompt = _get_persona_prompt("buddy")
        assert "小账" in prompt
        assert "回复风格" in prompt

    def test_get_persona_prompt_cat(self):
        from app.services.chat_service import _get_persona_prompt
        prompt = _get_persona_prompt("cat")
        assert "喵" in prompt
        assert "回复风格" in prompt

    def test_get_persona_prompt_empty(self):
        from app.services.chat_service import _get_persona_prompt
        assert _get_persona_prompt("") == ""
        assert _get_persona_prompt(None) == ""

    def test_get_persona_prompt_unknown_falls_back(self):
        """不在预设中的 persona 值直接当作自定义 prompt 使用"""
        from app.services.chat_service import _get_persona_prompt
        prompt = _get_persona_prompt("unknown_key")
        assert "回复风格" in prompt
        assert "unknown_key" in prompt

    def test_personas_module(self):
        from app.services.personas import PERSONAS, get_persona
        assert "buddy" in PERSONAS
        assert "cat" in PERSONAS
        assert "analyst" in PERSONAS
        assert "homie" in PERSONAS
        bp = get_persona("buddy")
        assert "小账" in bp
        cp = get_persona("cat")
        assert "喵" in cp

    def test_chat_service_with_persona_injects_into_history(self, db):
        """persona=buddy 应该在 system prompt 中包含角色设定"""
        seed_for_chat(db)
        svc = ChatService(db)
        svc.client = _make_mock_openai({"content": "老铁，这个月花得不多！"})
        result = svc.chat("这个月花了多少", persona="buddy")
        assert result["done"] is True
        # 从 DB 查询验证 system prompt 包含 persona 设定
        sid = result["session_id"]
        session = db.query(ChatSession).filter(ChatSession.session_key == sid).first()
        assert session is not None
        system_msg = session.messages[0]["content"]
        assert "回复风格" in system_msg or "小账" in system_msg


# ========== 6. System Prompt 日期注入测试 ==========

class TestSystemPrompt:
    def test_contains_current_date(self):
        from app.services.chat_service import _build_system_prompt
        prompt = _build_system_prompt()
        today = datetime.now()
        assert str(today.year) in prompt
        assert str(today.month) in prompt
        assert "当前时间" in prompt
        assert "本月" in prompt

    def test_contains_persona_prompt(self):
        from app.services.chat_service import _build_system_prompt
        prompt = _build_system_prompt("我是毒舌搭子")
        assert "我是毒舌搭子" in prompt


# ========== 7. 流式端点测试 ==========

class TestStreamEndpoint:
    def test_stream_status_events(self, api):
        """流式端点返回 SSE 事件流"""
        import app.config
        import app.api.v1.endpoints.chat as chat_module

        def mock_stream(*args, **kwargs):
            yield ChatService._sse("status", "测试中")
            yield ChatService._sse("reply_chunk", "你好")
            yield ChatService._sse("done", '{"session_id":"test"}')

        mock_svc = MagicMock()
        mock_svc.chat_stream = mock_stream

        with patch.object(app.config.settings, "OPENAI_API_KEY", "sk-test"), \
             patch.object(chat_module, "ChatService", return_value=mock_svc):
            resp = api.post("/api/v1/chat/stream", json={"message": "你好"})
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers.get("content-type", "")

    def test_chat_service_sse_helper(self):
        """测试 _sse 静态方法"""
        sse = ChatService._sse("test_event", "test_data")
        assert "event: test_event" in sse
        assert "data: test_data" in sse
        assert sse.endswith("\n\n")


# ========== 8. 确认流程上下文一致性测试（require.md Bug 1 & Bug 2） ==========

class TestConfirmationFlow:
    """测试 resume_after_confirmation 的 Tool Calling 规范合规性"""

    def _make_mock_openai_for_resume(self, final_reply: str):
        """创建 mock client 用于 resume_after_confirmation。

        _continue_conversation 会调用 create 两次：
        1. 工具选择阶段：返回 tool_calls=None → 进入回复阶段
        2. 流式回复阶段：返回可迭代的 stream chunks
        """
        mock_client = MagicMock()
        mock_completions = MagicMock()

        # 调用1（工具选择）：无 tool_calls → 进入回复
        mock_msg1 = MagicMock()
        mock_msg1.tool_calls = None
        mock_msg1.content = ""
        mock_resp1 = MagicMock()
        mock_resp1.choices = [MagicMock(message=mock_msg1)]

        # 调用2（流式回复）：返回可迭代的 stream
        # _continue_conversation 用 for chunk in stream: 迭代
        # 每个 chunk 需要有 chunk.choices[0].delta.content
        def make_chunk(text):
            chunk = MagicMock()
            delta = MagicMock()
            delta.content = text
            chunk.choices = [MagicMock(delta=delta)]
            return chunk

        stream_chunks = [make_chunk(final_reply)]

        mock_completions.create.side_effect = [mock_resp1, iter(stream_chunks)]
        mock_client.chat.completions = mock_completions
        return mock_client

    def _seed_session_with_pending_bills(self, db, session_id: str,
                                          bills: list[dict]) -> list[dict]:
        """构造一个包含待确认 create_bill tool_calls 的 history"""
        history = [
            {"role": "system", "content": "System prompt"},
            {"role": "user", "content": "午餐35元，打车20元"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": "create_bill",
                            "arguments": json.dumps(tc["arguments"]),
                        },
                    }
                    for tc in bills
                ],
            },
        ]
        # 持久化到 DB
        svc = ChatSessionService(db)
        svc.save(session_id, history)
        return history

    def test_bug1_modified_args_merged_not_replaced(self, db):
        """Bug 1: 修改金额时，原始参数（payee/transaction_date）不能丢失"""
        seed_for_chat(db)
        sid = "test_merge_001"
        bills = [
            {"id": "tc_001", "arguments": {
                "amount": -35, "category": "餐饮", "payee": "麦当劳",
                "description": "午餐", "transaction_date": "2026-06-10",
                "payment_method": "微信",
            }},
        ]
        self._seed_session_with_pending_bills(db, sid, bills)

        svc = ChatService(db, confirm_mode=True)
        svc.client = self._make_mock_openai_for_resume("已记录餐饮支出28元。")

        # 用户将金额从 35 改为 28
        modified = [{"tool_call_id": "tc_001", "amount": -28}]
        events = list(svc.resume_after_confirmation(sid, "confirm", modified))

        # 验证 DB 中写入的是修改后的金额
        from app.models.bill import Bill
        latest = db.query(Bill).order_by(Bill.id.desc()).first()
        assert latest is not None
        assert latest.amount == -28.0, f"期望金额 -28，实际 {latest.amount}"
        # 验证原始字段未丢失
        assert latest.payee == "麦当劳", f"期望 payee=麦当劳，实际 {latest.payee}"
        assert latest.description == "午餐"
        assert latest.payment_method == "微信"

    def test_bug1_assistant_tool_call_args_updated(self, db):
        """Bug 1: history 中 assistant tool_call arguments 必须更新为修改后的值"""
        seed_for_chat(db)
        sid = "test_args_update_002"
        bills = [
            {"id": "tc_001", "arguments": {"amount": -35, "category": "餐饮"}},
        ]
        self._seed_session_with_pending_bills(db, sid, bills)

        svc = ChatService(db, confirm_mode=True)
        svc.client = self._make_mock_openai_for_resume("已记录。")

        modified = [{"tool_call_id": "tc_001", "amount": -28, "category": "午餐"}]
        list(svc.resume_after_confirmation(sid, "confirm", modified))

        # 从 DB 读取 history，验证 assistant tool_call arguments 已更新
        session = db.query(ChatSession).filter(ChatSession.session_key == sid).first()
        history = session.messages
        assistant_msg = next((m for m in history if m.get("role") == "assistant" and m.get("tool_calls")), None)
        tc_args = json.loads(assistant_msg["tool_calls"][0]["function"]["arguments"])
        assert tc_args["amount"] == -28, f"期望 args.amount=-28，实际 {tc_args['amount']}"
        assert tc_args["category"] == "午餐", f"期望 args.category=午餐，实际 {tc_args['category']}"

    def test_bug2_ignored_bill_gets_tool_response(self, db):
        """Bug 2: 忽略的账单必须有 tool response，否则 LLM 会再次触发确认"""
        seed_for_chat(db)
        sid = "test_ignore_003"
        bills = [
            {"id": "tc_001", "arguments": {"amount": -35, "category": "餐饮", "payee": "麦当劳"}},
            {"id": "tc_002", "arguments": {"amount": -20, "category": "交通", "payee": "滴滴"}},
            {"id": "tc_003", "arguments": {"amount": -50, "category": "购物", "payee": "淘宝"}},
        ]
        self._seed_session_with_pending_bills(db, sid, bills)

        svc = ChatService(db, confirm_mode=True)
        svc.client = self._make_mock_openai_for_resume("已记录2笔账单，忽略1笔。")

        # 忽略 tc_002，确认 tc_001 和 tc_003
        events = list(svc.resume_after_confirmation(
            sid, "confirm", reject_ids=["tc_002"]
        ))

        # 验证 history 中每个 tool_call 都有对应 tool response
        session = db.query(ChatSession).filter(ChatSession.session_key == sid).first()
        history = session.messages
        tool_calls = [
            tc for m in history if m.get("role") == "assistant" and m.get("tool_calls")
            for tc in m["tool_calls"]
        ]
        tool_responses = [
            h for h in history if h.get("role") == "tool"
        ]
        tc_ids = {tc["id"] for tc in tool_calls}
        resp_ids = {h.get("tool_call_id") for h in tool_responses}
        missing = tc_ids - resp_ids
        assert not missing, f"缺少 tool response 的 tool_call_id: {missing}"

        # 验证被忽略的账单返回 ignored 状态
        ignored_resp = next(
            (json.loads(h["content"]) for h in tool_responses if h.get("tool_call_id") == "tc_002"),
            None,
        )
        assert ignored_resp is not None
        assert ignored_resp["status"] == "ignored", f"期望 ignored，实际 {ignored_resp['status']}"

        # 验证被忽略的账单没有写入 DB
        from app.models.bill import Bill
        bill_count = db.query(Bill).count()
        # seed 有 3 条 + 确认 2 条 = 5（不是 6）
        assert bill_count == 5, f"期望 5 条账单（3 seed + 2 确认），实际 {bill_count}"

    def test_bug2_no_duplicate_confirmation_after_ignore(self, db):
        """Bug 2: 忽略后 LLM 不应再次触发 create_bill 确认"""
        seed_for_chat(db)
        sid = "test_no_dup_004"
        bills = [
            {"id": "tc_001", "arguments": {"amount": -35, "category": "餐饮", "payee": "麦当劳"}},
            {"id": "tc_002", "arguments": {"amount": -20, "category": "交通", "payee": "滴滴"}},
        ]
        self._seed_session_with_pending_bills(db, sid, bills)

        # 构造一个会再次触发 create_bill 的 mock（模拟 LLM 不遵守规范的情况）
        mock_client = MagicMock()
        mock_completions = MagicMock()

        # 第一次调用：LLM 直接回复（不再触发 create_bill）
        mock_msg_reply = MagicMock()
        mock_msg_reply.tool_calls = None
        mock_msg_reply.content = "已记录1笔，忽略1笔。"
        mock_resp_reply = MagicMock()
        mock_resp_reply.choices = [MagicMock(message=mock_msg_reply)]
        mock_completions.create.return_value = mock_resp_reply

        mock_client.chat.completions = mock_completions
        svc = ChatService(db, confirm_mode=True)
        svc.client = mock_client

        events = list(svc.resume_after_confirmation(
            sid, "confirm", reject_ids=["tc_002"]
        ))

        # 验证没有再次触发 confirm_required 事件
        confirm_events = [e for e in events if isinstance(e, str) and "confirm_required" in e]
        assert len(confirm_events) == 0, "忽略后不应再次触发确认"

    def test_tool_response_format_success(self, db):
        """验证成功 tool response 格式符合 require.md 规定"""
        seed_for_chat(db)
        sid = "test_format_005"
        bills = [
            {"id": "tc_001", "arguments": {
                "amount": -35, "category": "餐饮", "payee": "麦当劳",
                "transaction_date": "2026-06-10",
            }},
        ]
        self._seed_session_with_pending_bills(db, sid, bills)

        svc = ChatService(db, confirm_mode=True)
        svc.client = self._make_mock_openai_for_resume("已记录。")
        list(svc.resume_after_confirmation(sid, "confirm"))

        session = db.query(ChatSession).filter(ChatSession.session_key == sid).first()
        history = session.messages
        tool_resp = next(h for h in history if h.get("role") == "tool")
        data = json.loads(tool_resp["content"])

        assert data["status"] == "success"
        assert "bill" in data
        assert data["bill"]["amount"] == -35.0
        assert data["bill"]["category"] == "餐饮"
        assert data["bill"]["payee"] == "麦当劳"

    def test_tool_response_format_ignored(self, db):
        """验证忽略 tool response 格式符合 require.md 规定"""
        seed_for_chat(db)
        sid = "test_format_006"
        bills = [
            {"id": "tc_001", "arguments": {"amount": -35, "category": "餐饮"}},
        ]
        self._seed_session_with_pending_bills(db, sid, bills)

        svc = ChatService(db, confirm_mode=True)
        svc.client = self._make_mock_openai_for_resume("已忽略。")
        list(svc.resume_after_confirmation(sid, "confirm", reject_ids=["tc_001"]))

        session = db.query(ChatSession).filter(ChatSession.session_key == sid).first()
        history = session.messages
        tool_resp = next(h for h in history if h.get("role") == "tool")
        data = json.loads(tool_resp["content"])

        assert data["status"] == "ignored"
        assert "bill" not in data  # 忽略时不应有 bill 数据

    def test_confirmation_summary_injected(self, db):
        """验证确认摘要消息注入到 LLM 上下文中"""
        seed_for_chat(db)
        sid = "test_summary_007"
        bills = [
            {"id": "tc_001", "arguments": {
                "amount": -35, "category": "餐饮", "payee": "麦当劳",
            }},
        ]
        self._seed_session_with_pending_bills(db, sid, bills)

        svc = ChatService(db, confirm_mode=True)
        svc.client = self._make_mock_openai_for_resume("已记录麦当劳35元。")
        list(svc.resume_after_confirmation(sid, "confirm"))

        session = db.query(ChatSession).filter(ChatSession.session_key == sid).first()
        history = session.messages
        # 找到系统确认消息
        summary_msgs = [
            m for m in history
            if m.get("role") == "user" and "系统确认" in m.get("content", "")
        ]
        assert len(summary_msgs) == 1, "应有一条系统确认消息"
        assert "麦当劳" in summary_msgs[0]["content"]
        assert "35.00元" in summary_msgs[0]["content"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
