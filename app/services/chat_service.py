# app/services/chat_service.py
"""AI 对话服务 — LLM 对话循环 + 工具调用编排"""

import json
import uuid
import logging
from datetime import date, datetime
from typing import Optional

from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.services.tool_definitions import TOOLS
from app.services.bill_service import BillService
from app.services.category_service import CategoryService
from app.services.statistics_service import StatisticsService
from app.schemas.bill import BillCreate
from app.schemas.statistics import MonthlySummary, CategoryBreakdownItem, TrendItem

logger = logging.getLogger(__name__)


# ---------- 会话存储（内存 dict，后续可迁移到 Redis/DB） ----------
# key: session_id, value: list[dict]  # OpenAI 消息格式
_sessions: dict[str, list[dict]] = {}


def _get_or_create_session(session_id: Optional[str]) -> tuple[str, list[dict]]:
    """获取已有会话或创建新会话，返回 (session_id, history)"""
    if session_id and session_id in _sessions:
        return session_id, _sessions[session_id]
    new_id = session_id or uuid.uuid4().hex[:12]
    _sessions[new_id] = []
    return new_id, _sessions[new_id]


# ---------- System Prompt ----------

SYSTEM_PROMPT = """你是一个智能记账助手 BillAgent，帮助用户管理和查询财务账单。

## 你的能力
- 查询账单：按日期、分类、收支方向筛选账单记录
- 创建账单：记录一笔新的收入或支出
- 统计分析：月度汇总、分类分布、消费趋势
- 分类管理：查看可用分类列表

## 重要规则
1. 金额符号：支出为负数（如 -35），收入为正数（如 5000）
2. 日期格式：YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS
3. 在创建账单前，如果不确定分类名称是否正确，先调用 list_categories 确认
4. 用户提到"今天"或"本月"时，请基于当前日期推断具体日期参数
5. 回应用户时用中文，回复简洁友好，涉及金额时标注单位（元）
6. 查询账单后，如果结果较多，简要概括而不是逐条罗列
"""


# ---------- Tool 执行器 ----------

class ToolExecutor:
    """将 LLM 请求的工具名称和参数路由到实际的服务方法"""

    def __init__(self, db: Session):
        self.db = db

    def execute(self, tool_name: str, arguments: dict) -> str:
        """执行工具调用，返回 JSON 字符串结果"""
        logger.info(f"执行工具: {tool_name}, 参数: {arguments}")
        try:
            if tool_name == "query_bills":
                return self._query_bills(arguments)
            elif tool_name == "create_bill":
                return self._create_bill(arguments)
            elif tool_name == "get_monthly_summary":
                return self._get_monthly_summary(arguments)
            elif tool_name == "get_category_breakdown":
                return self._get_category_breakdown(arguments)
            elif tool_name == "get_trend":
                return self._get_trend(arguments)
            elif tool_name == "list_categories":
                return self._list_categories()
            else:
                return json.dumps({"error": f"未知工具: {tool_name}"}, ensure_ascii=False)
        except Exception as e:
            logger.exception(f"工具执行失败: {tool_name}")
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    # ---- 各工具实现 ----

    def _query_bills(self, args: dict) -> str:
        """查询账单列表，支持日期/分类/方向过滤"""
        svc = BillService(self.db)
        # 获取所有账单后内存过滤（简单实现，数据量大时可改为 SQL 过滤）
        bills = svc.get_bills(limit=args.get("limit", 20) or 100)

        filtered = []
        for b in bills:
            # 日期过滤
            if args.get("start_date") and b.transaction_date:
                start = datetime.strptime(args["start_date"], "%Y-%m-%d")
                if b.transaction_date < start:
                    continue
            if args.get("end_date") and b.transaction_date:
                end = datetime.strptime(args["end_date"], "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                if b.transaction_date > end:
                    continue
            # 分类过滤
            if args.get("category") and b.category != args["category"]:
                continue
            # 方向过滤
            direction = args.get("direction")
            if direction:
                if direction == "支出" and b.amount >= 0:
                    continue
                if direction == "收入" and b.amount <= 0:
                    continue
            filtered.append(b)

        limit = args.get("limit", 20) or 20
        filtered = filtered[:limit]

        result = [
            {
                "id": b.id,
                "amount": b.amount,
                "direction": "支出" if b.amount < 0 else "收入",
                "category": b.category or "未分类",
                "payee": b.payee,
                "description": b.description,
                "transaction_date": b.transaction_date.strftime("%Y-%m-%d %H:%M") if b.transaction_date else None,
                "payment_method": b.payment_method,
            }
            for b in filtered
        ]
        return json.dumps({"count": len(result), "bills": result}, ensure_ascii=False)

    def _create_bill(self, args: dict) -> str:
        """创建一条账单记录"""
        svc = BillService(self.db)

        # 解析日期
        trans_date = None
        raw_date = args.get("transaction_date")
        if raw_date:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    trans_date = datetime.strptime(raw_date, fmt)
                    break
                except ValueError:
                    continue

        bill_data = BillCreate(
            amount=float(args["amount"]),
            category=args.get("category", "未分类"),
            transaction_date=trans_date,
            note=args.get("remark"),
        )
        bill = svc.create_bill(bill_data)

        # 补充 direction/payee/description/remark 字段（不在 BillCreate 中，需要直接更新）
        if args.get("direction"):
            bill.direction = args["direction"]
        if args.get("payee"):
            bill.payee = args["payee"]
        if args.get("description"):
            bill.description = args["description"]
        if args.get("payment_method"):
            bill.payment_method = args["payment_method"]
        if args.get("remark"):
            bill.remark = args["remark"]
        self.db.commit()
        self.db.refresh(bill)

        return json.dumps({
            "success": True,
            "bill": {
                "id": bill.id,
                "amount": bill.amount,
                "direction": bill.direction or ("支出" if bill.amount < 0 else "收入"),
                "category": bill.category,
                "transaction_date": bill.transaction_date.strftime("%Y-%m-%d") if bill.transaction_date else None,
            },
        }, ensure_ascii=False)

    def _get_monthly_summary(self, args: dict) -> str:
        """获取月度收支汇总"""
        svc = StatisticsService(self.db)
        summary: MonthlySummary = svc.monthly_summary(
            year=int(args["year"]),
            month=int(args["month"]),
        )
        return json.dumps(summary.model_dump(), ensure_ascii=False)

    def _get_category_breakdown(self, args: dict) -> str:
        """获取分类消费分布"""
        svc = StatisticsService(self.db)
        start_date = date.fromisoformat(args["start_date"]) if args.get("start_date") else None
        end_date = date.fromisoformat(args["end_date"]) if args.get("end_date") else None
        direction = args.get("direction", "支出")
        items: list[CategoryBreakdownItem] = svc.category_breakdown(start_date, end_date, direction)
        return json.dumps([item.model_dump() for item in items], ensure_ascii=False)

    def _get_trend(self, args: dict) -> str:
        """获取消费趋势"""
        svc = StatisticsService(self.db)
        start_date = date.fromisoformat(args["start_date"])
        end_date = date.fromisoformat(args["end_date"])
        granularity = args.get("granularity", "monthly")
        items: list[TrendItem] = svc.trend(start_date, end_date, granularity)
        return json.dumps([item.model_dump() for item in items], ensure_ascii=False)

    def _list_categories(self) -> str:
        """列出所有分类"""
        svc = CategoryService(self.db)
        cats = svc.get_all()
        result = [
            {"id": c.id, "name": c.name, "keywords": c.keywords or ""}
            for c in cats
        ]
        return json.dumps(result, ensure_ascii=False)


# ---------- ChatService ----------

class ChatService:
    """AI 对话服务：编排 LLM 调用和工具执行，管理会话历史"""

    def __init__(self, db: Session):
        self.db = db
        # 初始化 OpenAI 客户端（兼容任何 OpenAI API 格式的服务）
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY or "sk-placeholder",
            base_url=settings.OPENAI_BASE_URL,
        )
        self.executor = ToolExecutor(db)

    def chat(self, message: str, session_id: Optional[str] = None) -> dict:
        """处理用户消息，返回包含回复和工具调用追踪的结果"""
        sid, history = _get_or_create_session(session_id)

        # 如果是新会话，添加 system prompt
        if not history:
            history.append({"role": "system", "content": SYSTEM_PROMPT})

        # 添加用户消息
        history.append({"role": "user", "content": message})

        # 调用 LLM（可能产生多轮 tool call）
        tool_records: list[dict] = []
        reply = self._run_conversation(history, tool_records)

        # 清理过长的历史记录（保留 system + 最近 20 轮）
        if len(history) > 22:  # system(1) + user+assistant(20)
            history[1:-20] = []  # 删除中间的旧消息

        return {
            "reply": reply,
            "session_id": sid,
            "tool_calls": tool_records,
            "done": True,
        }

    def _run_conversation(self, history: list[dict], tool_records: list[dict]) -> str:
        """执行对话循环：LLM 调用 → 工具执行 → LLM 再调用，直到得到纯文本回复"""
        # 最多循环 3 次防止无限工具调用
        for _ in range(3):
            response = self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=history,
                tools=TOOLS,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
            )

            msg = response.choices[0].message

            # 如果没有工具调用，返回纯文本回复
            if not msg.tool_calls:
                content = msg.content or ""
                history.append({"role": "assistant", "content": content})
                return content

            # 有工具调用：记录 assistant 消息（含 tool_calls）
            history.append({
                "role": "assistant",
                "content": msg.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ],
            })

            # 依次执行每个工具调用
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                arguments = json.loads(tc.function.arguments)

                result_str = self.executor.execute(tool_name, arguments)

                # 记录工具调用轨迹
                tool_records.append({
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "result": result_str[:500],  # 截断过长结果
                })

                # 将工具结果添加到对话历史
                history.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

        # 超过最大循环次数，强制 LLM 总结
        return "抱歉，处理您的请求时遇到了一些问题，请稍后重试。"
