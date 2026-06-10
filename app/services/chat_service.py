# app/services/chat_service.py
"""AI 对话服务 — LLM 对话循环 + 工具调用编排"""

import json
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
from app.services.chat_session_service import ChatSessionService
from app.schemas.bill import BillCreate
from app.schemas.statistics import MonthlySummary, CategoryBreakdownItem, TrendItem

logger = logging.getLogger(__name__)


# ---------- System Prompt ----------

def _build_system_prompt(persona_prompt: str = "", time_str: Optional[str] = None) -> str:
    """构建 system prompt，注入统一时间锚点和可选 persona 设定。
    time_str 由 ChatService 入口锁定，确保 LLM+OCR 使用同一时间基准。
    """
    now = datetime.now()
    if time_str:
        try:
            now = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass  # 格式异常时 fallback 到当前时间

    weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    today_str = now.strftime("%Y-%m-%d")
    weekday = weekday_names[now.weekday()]
    month_str = now.strftime("%Y年%m月")

    base = f"""你是 BillAgent 智能记账助手。

当前时间: {today_str}（{weekday}） 本月: {month_str}

## 规则

- 金额: 支出负数、收入正数。日期: YYYY-MM-DD
- 用户说"今天/本月"等词时，用上方当前时间推算具体日期
- 记账前不确定分类名时先调 list_categories
- 收到账单截图时，先调 scan_receipt 提取交易，再逐条调 create_bill 入库
- 回复简短、口语化，金额带"元"

## 回复格式
- 日常对话、简单回复 → Markdown
- 统计数据/表格/汇总 → JSON 内容块数组:
[{{"type":"heading","level":2,"content":"标题"}},{{"type":"summary","cards":[{{"label":"支出","value":"674元"}}]}},{{"type":"table","headers":["分类","金额"],"rows":[["餐饮","347元"]]}},{{"type":"bill_list","bills":[{{"date":"06-01","category":"餐饮","payee":"麦当劳","amount":"-35.00"}}]}},{{"type":"callout","level":"warning","content":"提示"}},{{"type":"text","content":"分析说明"}},{{"type":"divider"}}]
JSON 数组必须是全部回复，不要混入其他文字。
{persona_prompt}"""
    return base


# ---------- Tool 执行器 ----------

class ToolExecutor:
    """将 LLM 请求的工具名称和参数路由到实际的服务方法。
    通过构造函数注入统一时间锚点和图片数据，OCR 与 LLM 使用同一时间基准。
    """

    def __init__(self, db: Session, current_time_str: str = "",
                 image_base64: str = "", image_content_type: str = "image/jpeg",
                 openai_client: Optional[OpenAI] = None):
        self.db = db
        self.current_time_str = current_time_str or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.image_base64 = image_base64
        self.image_content_type = image_content_type
        self.llm_client = openai_client  # 复用 ChatService 的 OpenAI 连接

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
            elif tool_name == "get_budget_status":
                return self._get_budget_status(arguments)
            elif tool_name == "suggest_budget":
                return self._suggest_budget(arguments)
            elif tool_name == "scan_receipt":
                return self._scan_receipt(arguments)
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
        """创建一条账单记录。自动补全 category_id，确保 其他/未分类 等分类正常入库。"""
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

        # 分类名：默认使用"其他"（种子数据中的兜底分类）
        category_name = args.get("category") or "其他"

        bill_data = BillCreate(
            amount=float(args["amount"]),
            category=category_name,
            category_id=svc._resolve_category_id(category_name),
            transaction_date=trans_date,
            note=args.get("remark"),
        )
        bill = svc.create_bill(bill_data)

        # 补充 direction/payee/description/remark 字段
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
            "status": "success",
            "bill": {
                "id": bill.id,
                "amount": bill.amount,
                "direction": bill.direction or ("支出" if bill.amount < 0 else "收入"),
                "category": bill.category,
                "payee": bill.payee,
                "description": bill.description,
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

    def _get_budget_status(self, args: dict) -> str:
        """获取预算 vs 实际对比"""
        from app.services.budget_service import BudgetService
        svc = BudgetService(self.db)
        result = svc.vs_actual(int(args["year"]), int(args["month"]))
        return json.dumps(result.model_dump(), ensure_ascii=False)

    def _suggest_budget(self, args: dict) -> str:
        """AI 预算建议 — 复用 ChatService 的 OpenAI 客户端"""
        from app.services.budget_service import BudgetService
        svc = BudgetService(self.db)
        suggestions = svc.suggest_budget(
            int(args["year"]), int(args["month"]), client=self.llm_client
        )
        return json.dumps([s.model_dump() for s in suggestions], ensure_ascii=False)

    def _scan_receipt(self, args: dict) -> str:
        """调用 OCRService 识别账单截图，使用 ChatService 的统一时间锚点"""
        # 优先使用 args 中传入的 image，其次使用 ChatService 构造时注入的
        image_b64 = args.get("image_base64") or self.image_base64
        image_type = args.get("image_content_type") or self.image_content_type
        if not image_b64:
            return json.dumps({
                "success": False,
                "message": "未提供图片数据，请通过 /ocr/recognize 端点上传或附带 image_base64 参数",
            }, ensure_ascii=False)

        from app.services.ocr_service import OCRService
        ocr = OCRService()
        # 传入统一时间锚点，保证 OCR 的日期推理与 LLM System Prompt 一致
        result = ocr.recognize(image_b64, image_type, current_time_str=self.current_time_str)

        result_dict = result.model_dump()
        result_dict["time_anchor"] = self.current_time_str
        return json.dumps(result_dict, ensure_ascii=False)


# ---------- 辅助函数 ----------

def _prune_history(history: list[dict], keep_recent: int = 10):
    """修剪过长历史：保留 system prompt + 最近 keep_recent 轮对话"""
    if len(history) <= keep_recent * 2 + 1:
        return
    # 保留 system prompt
    system_msgs = [m for m in history if m.get("role") == "system"]
    non_system = [m for m in history if m.get("role") != "system"]
    # 从末尾保留最近几轮
    recent = non_system[-keep_recent * 2:] if len(non_system) > keep_recent * 2 else non_system
    history[:] = system_msgs + recent


# ---------- Persona（角色预设） ----------

def _get_persona_prompt(persona: str) -> str:
    """根据角色名返回对应的 system prompt 追加文本"""
    if not persona:
        return ""
    from app.services.personas import get_persona
    prompt = get_persona(persona)
    if prompt:
        return f"\n## 回复风格\n{prompt}"
    return ""


# ---------- ChatService ----------

class ChatService:
    """AI 对话服务：编排 LLM 调用和工具执行，管理会话历史。
    在入口处锁定统一时间锚点，保证 LLM 和 OCR 使用同一时间基准。
    """

    def __init__(self, db: Session, image_base64: str = "", image_content_type: str = "image/jpeg",
                 confirm_mode: bool = False):
        self.db = db
        self.session_svc = ChatSessionService(db)
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY or "sk-placeholder",
            base_url=settings.OPENAI_BASE_URL,
        )
        # 统一时间锚点：入口处锁定，整个对话链复用
        self._time_anchor = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # 图片数据（来自 ChatRequest），供 ToolExecutor 的 scan_receipt 使用
        self._image_b64 = image_base64
        self._image_type = image_content_type
        # 二次确认模式：创建账单前需要用户确认
        self._confirm_mode = confirm_mode
        # 延迟初始化 executor（在 chat/chat_stream 中创建，确保时间锚点已就绪）
        self.executor: Optional[ToolExecutor] = None

    def _get_executor(self) -> ToolExecutor:
        if self.executor is None:
            self.executor = ToolExecutor(
                self.db, self._time_anchor, self._image_b64, self._image_type,
                openai_client=self.client,
            )
        return self.executor

    def _build_user_content(self, message: str):
        """构建发给 LLM 的用户消息内容。
        如果有图片，使用 vision 格式（image + text）；否则纯文本。
        """
        if self._image_b64:
            return [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{self._image_type};base64,{self._image_b64}"},
                },
                {"type": "text", "text": message or "请识别这张账单截图中的所有交易记录，并帮我记账"},
            ]
        return message

    def chat(self, message: str, session_id: Optional[str] = None, persona: str = "") -> dict:
        """处理用户消息，返回包含回复和工具调用追踪的结果。会话持久化到 DB，支持 TTL 压缩。"""
        sid, history = self.session_svc.get_or_create(session_id)

        # 始终刷新 system prompt 中的当前时间（每次对话都更新为实时时间）
        persona_prompt = _get_persona_prompt(persona)
        system_msg = {"role": "system", "content": _build_system_prompt(persona_prompt, self._time_anchor)}
        if not history:
            history.append(system_msg)
        elif history[0].get("role") == "system":
            history[0] = system_msg  # 替换旧时间
        else:
            history.insert(0, system_msg)

        # 添加用户消息（支持图片）
        history.append({"role": "user", "content": self._build_user_content(message)})

        # 调用 LLM（可能产生多轮 tool call，包括 scan_receipt → create_bill 联动）
        tool_records: list[dict] = []
        reply = self._run_conversation(history, tool_records)

        # 清理过长历史（保留 system + 最近 10 轮，含本轮）
        _prune_history(history, keep_recent=settings.CHAT_KEEP_RECENT_ROUNDS + 5)

        # 持久化到数据库
        self.session_svc.save(sid, history, persona)

        return {
            "reply": reply,
            "session_id": sid,
            "tool_calls": tool_records,
            "done": True,
        }

    def _run_conversation(self, history: list[dict], tool_records: list[dict]) -> str:
        """执行对话循环，工具选择用低 token，最终回复用高 token"""
        for loop in range(3):
            # 工具选择阶段用适中 max_tokens（DeepSeek 等推理模型 thinking 令牌包含在内）
            is_first_pass = (loop == 0)
            max_tok = 2048 if is_first_pass else settings.LLM_MAX_TOKENS

            response = self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=history,
                tools=TOOLS,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=max_tok,
            )

            msg = response.choices[0].message

            # 无工具调用 → 最终回复
            if not msg.tool_calls:
                content = msg.content or ""
                history.append({"role": "assistant", "content": content})
                return content

            # 记录 assistant 消息（含 tool_calls）
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

            # 依次执行工具调用
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                arguments = json.loads(tc.function.arguments)
                result_str = self._get_executor().execute(tool_name, arguments)
                tool_records.append({
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "result": result_str[:500],
                })
                history.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

        return "抱歉，处理您的请求时遇到了一些问题，请稍后重试。"

    def chat_stream(self, message: str, session_id: Optional[str] = None, persona: str = ""):
        """流式对话：生成器逐条产出 SSE 格式字符串。会话持久化到 DB。"""
        sid, history = self.session_svc.get_or_create(session_id)

        # 始终刷新 system prompt 中的当前时间
        persona_prompt = _get_persona_prompt(persona)
        system_msg = {"role": "system", "content": _build_system_prompt(persona_prompt, self._time_anchor)}
        if not history:
            history.append(system_msg)
        elif history[0].get("role") == "system":
            history[0] = system_msg
        else:
            history.insert(0, system_msg)
        history.append({"role": "user", "content": self._build_user_content(message)})

        # 工具选择阶段
        yield self._sse("status", "正在分析你的问题...")
        tool_records: list[dict] = []

        for loop in range(3):
            response = self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=history,
                tools=TOOLS,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=2048,
            )
            msg = response.choices[0].message

            # 无工具调用 → 流式输出最终回复
            if not msg.tool_calls:
                yield self._sse("status", "正在组织回复...")
                full_reply = ""
                stream = self.client.chat.completions.create(
                    model=settings.LLM_MODEL,
                    messages=history,
                    temperature=settings.LLM_TEMPERATURE,
                    max_tokens=settings.LLM_MAX_TOKENS,
                    stream=True,
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        full_reply += delta.content
                # 混合路由：优先 JSON 内容块，回退 Markdown
                # 空回复保护：LLM 可能将所有 token 用于 thinking，无可见输出
                if not full_reply.strip():
                    full_reply = "抱歉，我正在思考中，请稍后重试。"
                blocks = self._parse_content_blocks(full_reply)
                has_structured = any(b['type'] != 'text' for b in blocks)
                if has_structured:
                    for block in blocks:
                        yield self._sse("content_block", json.dumps(block, ensure_ascii=False))
                else:
                    yield self._sse("reply_chunk", full_reply)
                history.append({"role": "assistant", "content": full_reply})
                _prune_history(history, keep_recent=settings.CHAT_KEEP_RECENT_ROUNDS + 5)
                self.session_svc.save(sid, history, persona)
                yield self._sse("done", json.dumps({
                    "session_id": sid,
                    "tool_calls": tool_records,
                }, ensure_ascii=False))
                return

            # 有工具调用 — 先执行非 create_bill 工具，收集待确认的 create_bill
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

            # 收集本批次所有 create_bill（确认模式下暂不执行）
            pending_bills: list[dict] = []
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                arguments = json.loads(tc.function.arguments)
                yield self._sse("tool_call", json.dumps({
                    "tool_name": tool_name,
                    "arguments": arguments,
                }, ensure_ascii=False))

                if self._confirm_mode and tool_name == "create_bill":
                    pending_bills.append({
                        "tool_name": tool_name,
                        "arguments": arguments,
                        "tool_call_id": tc.id,
                    })
                else:
                    result_str = self._get_executor().execute(tool_name, arguments)
                    tool_records.append({
                        "tool_name": tool_name,
                        "arguments": arguments,
                        "result": result_str[:500],
                    })
                    history.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_str,
                    })

            # 有批量待确认的 create_bill → 统一发送确认请求
            if pending_bills:
                self.session_svc.save(sid, history, persona)
                yield self._sse("confirm_required", json.dumps({
                    "bills": pending_bills,
                }, ensure_ascii=False))
                yield self._sse("done", json.dumps({
                    "session_id": sid,
                    "pending_confirmation": True,
                    "bills": pending_bills,
                }, ensure_ascii=False))
                return

        yield self._sse("error", "处理超时，请稍后重试")
        yield self._sse("done", json.dumps({
            "session_id": sid,
            "tool_calls": tool_records,
        }, ensure_ascii=False))

    def resume_after_confirmation(self, session_id: str, action: str,
                                  modified_arguments: list = None,
                                  reject_ids: list = None):
        """用户确认/取消后恢复对话流（支持批量账单 + 逐条拒绝）。
        action='confirm': 执行待确认的 create_bill，reject_ids 中的除外。
        action='reject': 跳过所有待确认的 create_bill。
        modified_arguments: [{tool_call_id, ...fields}] 用户修改后的参数列表。
        reject_ids: 要单独拒绝的 tool_call_id 列表。
        """
        sid, history = self.session_svc.get_or_create(session_id)

        # 收集最后一个 assistant 消息中所有待确认的 create_bill
        pending_bills: list[dict] = []
        for msg in reversed(history):
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                for tc in msg["tool_calls"]:
                    if tc["function"]["name"] == "create_bill":
                        # 检查该 tool_call 是否已有 tool result（已执行过的跳过）
                        already_done = any(
                            h.get("role") == "tool" and h.get("tool_call_id") == tc["id"]
                            for h in history
                        )
                        if not already_done:
                            pending_bills.append({
                                "tool_call_id": tc["id"],
                                "arguments": json.loads(tc["function"]["arguments"]),
                            })
                if pending_bills:
                    break  # 只处理最近一批

        if not pending_bills:
            yield self._sse("error", "未找到待确认的记账操作")
            yield self._sse("done", json.dumps({"session_id": sid, "error": "no pending confirmation"}))
            return

        # 构建修改参数索引 {tool_call_id: modified_args}
        mod_index: dict[str, dict] = {}
        if modified_arguments:
            for item in modified_arguments:
                tcid = item.get("tool_call_id")
                if tcid:
                    mod_index[tcid] = {k: v for k, v in item.items() if k != "tool_call_id"}

        # 拒绝名单
        skip_ids = set(reject_ids or [])

        # 更新 assistant 消息中的 tool_call arguments，确保 LLM 看到的 args
        # 与即将执行的工具调用一致（避免 LLM 回复引用原始值而非用户修改后的值）
        if mod_index:
            for msg in reversed(history):
                if msg.get("role") == "assistant" and msg.get("tool_calls"):
                    for tc in msg["tool_calls"]:
                        tcid = tc["id"]
                        if tcid in mod_index:
                            original_args = json.loads(tc["function"]["arguments"])
                            merged = {**original_args, **mod_index[tcid]}
                            tc["function"]["arguments"] = json.dumps(merged, ensure_ascii=False)
                    break  # 只更新最近一个含 tool_calls 的 assistant 消息

        # 逐条执行或跳过，保证每个 tool_call_id 都有对应 tool response
        for bill in pending_bills:
            tcid = bill["tool_call_id"]
            if action == "reject" or tcid in skip_ids:
                # 忽略：返回 ignored 状态（require.md 规定格式）
                result_str = json.dumps({
                    "status": "ignored",
                }, ensure_ascii=False)
            else:
                # 将用户修改合并到原始参数上（mod_index 只有修改字段，不能直接替换）
                args = dict(bill["arguments"])
                if tcid in mod_index:
                    args.update(mod_index[tcid])
                # 执行 create_bill，返回包含实际 DB 数据的 success 响应
                result_str = self._get_executor().execute("create_bill", args)

            history.append({
                "role": "tool",
                "tool_call_id": tcid,
                "content": result_str,
            })

        # OpenAI Tool Calling 规范校验：每个 tool_call 必须有对应 tool response
        pending_ids = {b["tool_call_id"] for b in pending_bills}
        responded_ids = {
            h.get("tool_call_id") for h in history
            if h.get("role") == "tool" and h.get("tool_call_id") in pending_ids
        }
        missing = pending_ids - responded_ids
        if missing:
            logger.error(f"Tool Calling 规范违反：缺少 tool response 的 tool_call_id: {missing}")
            yield self._sse("error", "内部错误：工具调用响应不完整")
            yield self._sse("done", json.dumps({"session_id": sid, "error": "missing tool responses"}))
            return

        # 构建确认摘要注入 LLM 上下文，确保 LLM 引用实际执行的记账结果
        confirmed_parts: list[str] = []
        for bill in pending_bills:
            tcid = bill["tool_call_id"]
            if action == "reject" or tcid in skip_ids:
                continue
            # 从 tool response 中解析实际记账结果（比重新组装更准确）
            tool_resp = next(
                (json.loads(h["content"]) for h in history
                 if h.get("role") == "tool" and h.get("tool_call_id") == tcid),
                None,
            )
            if tool_resp and tool_resp.get("status") == "success":
                bill_data = tool_resp.get("bill", {})
                payee = bill_data.get("payee", "未知")
                amount = bill_data.get("amount", 0)
                category = bill_data.get("category", "")
                confirmed_parts.append(f"{payee} {abs(amount):.2f}元（{category}）")

        if confirmed_parts:
            summary = "、".join(confirmed_parts)
            ignored_count = len(skip_ids) + (1 if action == "reject" else 0)
            history.append({
                "role": "user",
                "content": f"【系统确认】用户已确认记账操作。实际记账结果：{summary}。请在回复中引用这些实际结果，不要引用修改前的原始估算值。"
                          + (f" 已忽略 {ignored_count} 笔账单。" if ignored_count else ""),
            })

        # 继续 LLM 对话循环
        yield from self._continue_conversation(history, sid)

    def _continue_conversation(self, history: list[dict], sid: str):
        """内部方法：从当前 history 继续 LLM 对话循环，产出 SSE 事件"""
        for loop in range(3):
            response = self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=history,
                tools=TOOLS,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=2048,
            )
            msg = response.choices[0].message

            # 无工具调用 → 流式输出最终回复
            if not msg.tool_calls:
                yield self._sse("status", "正在组织回复...")
                full_reply = ""
                stream = self.client.chat.completions.create(
                    model=settings.LLM_MODEL,
                    messages=history,
                    temperature=settings.LLM_TEMPERATURE,
                    max_tokens=settings.LLM_MAX_TOKENS,
                    stream=True,
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        full_reply += delta.content
                # 混合路由 + 空回复保护
                if not full_reply.strip():
                    full_reply = "抱歉，我正在思考中，请稍后重试。"
                blocks = self._parse_content_blocks(full_reply)
                has_structured = any(b['type'] != 'text' for b in blocks)
                if has_structured:
                    for block in blocks:
                        yield self._sse("content_block", json.dumps(block, ensure_ascii=False))
                else:
                    yield self._sse("reply_chunk", full_reply)
                history.append({"role": "assistant", "content": full_reply})
                _prune_history(history, keep_recent=settings.CHAT_KEEP_RECENT_ROUNDS + 5)
                self.session_svc.save(sid, history)
                yield self._sse("done", json.dumps({
                    "session_id": sid,
                    "tool_calls": [],
                }, ensure_ascii=False))
                return

            # 有工具调用 — 批量收集 create_bill
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

            pending_bills: list[dict] = []
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                arguments = json.loads(tc.function.arguments)
                yield self._sse("tool_call", json.dumps({
                    "tool_name": tool_name,
                    "arguments": arguments,
                }, ensure_ascii=False))

                if self._confirm_mode and tool_name == "create_bill":
                    pending_bills.append({
                        "tool_name": tool_name,
                        "arguments": arguments,
                        "tool_call_id": tc.id,
                    })
                else:
                    result_str = self._get_executor().execute(tool_name, arguments)
                    history.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_str,
                    })

            if pending_bills:
                self.session_svc.save(sid, history)
                yield self._sse("confirm_required", json.dumps({
                    "bills": pending_bills,
                }, ensure_ascii=False))
                yield self._sse("done", json.dumps({
                    "session_id": sid,
                    "pending_confirmation": True,
                    "bills": pending_bills,
                }, ensure_ascii=False))
                return

        yield self._sse("error", "处理超时，请稍后重试")
        yield self._sse("done", json.dumps({
            "session_id": sid,
        }, ensure_ascii=False))

    @staticmethod
    def _parse_content_blocks(raw: str) -> list[dict]:
        """尝试将 LLM 回复解析为 JSON 内容块数组。
        成功则返回块列表；失败则返回单个 text 块（触发 Markdown 回退）。
        """
        import re
        from app.schemas.chat import BLOCK_CLASS_MAP

        text = raw.strip()
        m = re.search(r'```(?:json)?\s*(\[[\s\S]*?\])\s*```', text)
        if m:
            text = m.group(1).strip()
        m = re.search(r'\[[\s\S]*\]', text)
        if m:
            try:
                raw_blocks = json.loads(m.group(0))
                if isinstance(raw_blocks, list):
                    result = []
                    for item in raw_blocks:
                        if not isinstance(item, dict) or 'type' not in item:
                            continue
                        model_cls = BLOCK_CLASS_MAP.get(item.get('type', ''))
                        if model_cls is None:
                            continue
                        try:
                            result.append(model_cls(**item).model_dump())
                        except Exception:
                            continue
                    if result:
                        return result
            except (json.JSONDecodeError, Exception):
                pass
        # Markdown 回退 — 空内容时返回占位文本
        content = raw.strip() or "（空回复）"
        return [{"type": "text", "content": content}]

    @staticmethod
    def _sse(event: str, data: str) -> str:
        """构建一条 Server-Sent Event 格式字符串。
        将 data 内容按行拆分，每行前缀 data: ——避免 markdown 中的 \\n\\n
        被前端 SSE 解析器误判为帧结束标志。
        同时规范化 \\r\\n → \\n，确保跨平台换行一致。
        """
        # 规范化换行符：\r\n → \n，残留 \r → \n
        normalized = data.replace("\r\n", "\n").replace("\r", "\n")
        lines = normalized.split("\n")
        payload = f"event: {event}\n"
        for line in lines:
            payload += f"data: {line}\n"
        payload += "\n"
        return payload
