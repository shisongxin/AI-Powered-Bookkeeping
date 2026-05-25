# app/services/tool_definitions.py
"""OpenAI function calling 格式的工具定义，供 LLM 选择并调用"""

# 所有可用工具的 OpenAI function calling 定义列表
TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "query_bills",
            "description": "查询账单列表，支持按日期范围、分类名称和收支方向过滤。返回匹配的账单记录列表，每条包含金额、分类、日期、交易对方等信息。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "查询起始日期，格式 YYYY-MM-DD，如 2026-05-01",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "查询结束日期，格式 YYYY-MM-DD，如 2026-05-31",
                    },
                    "category": {
                        "type": "string",
                        "description": "按分类名称筛选，如 餐饮、交通、购物",
                    },
                    "direction": {
                        "type": "string",
                        "enum": ["支出", "收入"],
                        "description": "收支方向：支出 或 收入",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回记录数量上限，默认 20",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_bill",
            "description": "创建一条新的账单记录。金额为正数表示收入，负数表示支出。如无明确交易时间，使用当天日期。",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "交易金额。支出为负数（如 -35.0），收入为正数（如 5000.0）",
                    },
                    "category": {
                        "type": "string",
                        "description": "分类名称，如 餐饮、交通、购物、收入 等",
                    },
                    "direction": {
                        "type": "string",
                        "enum": ["支出", "收入"],
                        "description": "收支方向。金额为负时填 支出，金额为正时填 收入",
                    },
                    "payee": {
                        "type": "string",
                        "description": "交易对方，如 麦当劳、滴滴出行",
                    },
                    "description": {
                        "type": "string",
                        "description": "商品说明或交易描述",
                    },
                    "transaction_date": {
                        "type": "string",
                        "description": "交易日期，格式 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS",
                    },
                    "payment_method": {
                        "type": "string",
                        "description": "支付方式，如 微信、支付宝、银行卡、现金",
                    },
                    "remark": {
                        "type": "string",
                        "description": "备注信息",
                    },
                },
                "required": ["amount", "direction", "transaction_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_monthly_summary",
            "description": "获取指定年月的收支汇总。返回当月总收入、总支出、净额和交易笔数。适合回答 这个月花了多少、上个月收入多少 这类问题。",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {
                        "type": "integer",
                        "description": "年份，如 2026",
                    },
                    "month": {
                        "type": "integer",
                        "description": "月份，1-12，如 5 表示五月",
                    },
                },
                "required": ["year", "month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_category_breakdown",
            "description": "获取指定日期范围内按分类统计的消费分布，返回每个分类的总金额、交易笔数和占比百分比。适合回答 餐饮花了多少、各分类占比如何 这类问题。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "统计起始日期，格式 YYYY-MM-DD",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "统计结束日期，格式 YYYY-MM-DD",
                    },
                    "direction": {
                        "type": "string",
                        "enum": ["支出", "收入"],
                        "description": "统计方向：支出 或 收入，默认 支出",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trend",
            "description": "获取指定日期范围内的消费/收入趋势数据，按日/周/月聚合。适合回答 最近几个月趋势如何、这周每天花了多少 这类问题。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "趋势起始日期，格式 YYYY-MM-DD",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "趋势结束日期，格式 YYYY-MM-DD",
                    },
                    "granularity": {
                        "type": "string",
                        "enum": ["daily", "weekly", "monthly"],
                        "description": "粒度：daily 按天 / weekly 按周 / monthly 按月。默认 monthly",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_categories",
            "description": "列出系统中所有可用的账单分类及其关键词。创建账单前可先调用此工具确认分类名称。",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]


# 工具名称到简短描述的映射，用于构建 system prompt
TOOL_DESCRIPTIONS: dict[str, str] = {
    t["function"]["name"]: t["function"]["description"]
    for t in TOOLS
}
