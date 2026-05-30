# BillAgent — AI-Powered Bookkeeping

智能记账助手，支持多格式账单文件导入、自动分类、统计分析、AI 对话、消费分析和预算规划功能。

## 技术栈

| 层 | 技术 |
|---|---|
| Web 框架 | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0（同步模式） |
| 数据库 | PostgreSQL + psycopg2 |
| 迁移工具 | Alembic 1.13 |
| 数据解析 | pandas, pdfplumber, chardet |
| AI 对话 | OpenAI Function Calling（兼容 智谱/DeepSeek/Ollama） |
| 配置管理 | pydantic-settings + python-dotenv |
| 测试 | pytest 8.3 + httpx |

## 项目结构

```
app/
├── main.py                    # FastAPI 应用入口
├── config.py                  # 配置管理（环境变量）
├── core/
│   └── database.py            # 数据库引擎 & Session 管理
├── models/
│   ├── bill.py                # Bill ORM 模型（bills 表）
│   └── category.py            # Category ORM 模型（categories 表）
├── schemas/
│   ├── bill.py                # Pydantic 模型（请求/响应 + 解析中间格式）
│   ├── category.py            # Category Pydantic 模型
│   ├── chat.py                # Chat 请求/响应模型
│   └── statistics.py          # 统计查询响应模型
├── services/
│   ├── bill_service.py        # 账单业务逻辑（创建、导入、去重、自动分类）
│   ├── category_service.py    # 分类业务逻辑（CRUD + 关键词自动匹配）
│   ├── chat_service.py        # AI 对话编排（LLM 调用 + 工具执行 + 会话管理）
│   ├── tool_definitions.py    # 6 个工具的 OpenAI function calling 定义
│   ├── personas.py            # 角色预设（4 种风格 + 自定义）
│   └── statistics_service.py  # 统计业务逻辑（月度汇总、分类饼图、趋势）
├── api/v1/endpoints/
│   ├── bills.py               # 账单 CRUD + 文件上传解析
│   ├── categories.py          # 分类 CRUD + 自动匹配
│   ├── statistics.py          # 统计查询（月度汇总/分类饼图/消费趋势）
│   └── chat.py                # AI 对话（非流式 + SSE 流式）
└── utils/
    ├── bill_parser.py          # 通用账单解析器（Excel/CSV/PDF）
    ├── wechat_parser.py        # 微信账单专用解析器
    └── alipay_parser.py        # 支付宝账单专用解析器
alembic/
├── env.py                     # Alembic 环境配置（读取项目 DB URL）
└── versions/                  # 迁移脚本目录
tests/
├── conftest.py                # 共享 fixtures（SQLite + TestClient）
├── test_parsers.py            # 解析器测试（3 个用例）
├── test_categories.py         # 分类系统测试（30 个用例）
├── test_statistics.py         # 统计 API 测试（12 个用例）
└── test_chat.py               # AI 对话测试（28 个用例）
init_db.py                     # 数据库初始化（Alembic 迁移 + 种子数据）
requirements.txt               # Python 依赖
```

## 快速开始

### 1. 环境准备

- Python 3.10+
- PostgreSQL（默认连接 `postgres:697012@localhost:5432/bill_db`）

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

编辑 `.env` 文件，按需修改数据库连接等配置：

```env
DATABASE_URL=postgresql+psycopg2://postgres:697012@localhost:5432/bill_db

# LLM 配置（支持 OpenAI / 智谱 / DeepSeek / Ollama 等兼容服务）
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# 角色预设（可选: buddy / cat / analyst / homie / custom）
PERSONA=buddy
```

### 4. 初始化数据库

```bash
python init_db.py
```

脚本会运行 `alembic upgrade head` 创建所有表，然后种子 10 个默认分类。

### 5. 启动服务

```bash
uvicorn app.main:app --reload
```

访问 http://localhost:8000/docs 查看 Swagger API 文档。

### 6. 运行测试

```bash
pytest tests/ -v
```

当前 73 个测试用例，覆盖分类 CRUD、自动分类、账单导入、统计查询、AI 对话、工具调用、流式输出、角色预设等全部功能。

## 数据库迁移

项目使用 Alembic 管理数据库版本，迁移脚本位于 `alembic/versions/`。

```bash
# 生成新迁移（模型变更后）
alembic revision --autogenerate -m "描述"

# 应用迁移到最新版本
alembic upgrade head

# 回滚一个版本
alembic downgrade -1

# 查看迁移历史
alembic history
```

## 已实现功能

### 分类管理系统

完整的分类 CRUD，支持通过关键词自动匹配账单到对应分类。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/categories/` | 创建分类 |
| GET | `/api/v1/categories/` | 分类列表 |
| GET | `/api/v1/categories/{id}` | 分类详情 |
| PUT | `/api/v1/categories/{id}` | 更新分类 |
| DELETE | `/api/v1/categories/{id}` | 删除分类 |
| POST | `/api/v1/categories/match` | 文本自动匹配分类 |

**自动分类机制**：每个分类维护一组关键词（逗号分隔），导入账单时遍历所有分类取最高匹配度。无法匹配则回退到 `transaction_type` 或"未分类"。

### 账单文件上传 & 自动解析

`POST /api/v1/bills/upload` — 上传账单文件，自动识别格式、解析、分类、去重、入库。

- 支持 CSV / Excel (.xlsx, .xls) / PDF
- 自动识别文件编码、表头行位置、字段映射
- 解析后自动匹配分类，基于交易单号或日期+金额+对方去重

### 统计数据 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/statistics/monthly-summary?year=&month=` | 月度收支汇总 |
| GET | `/api/v1/statistics/by-category?start_date=&end_date=&direction=` | 按分类统计（饼图数据） |
| GET | `/api/v1/statistics/trend?start_date=&end_date=&granularity=` | 消费趋势（daily/weekly/monthly） |

**使用示例**：

```bash
# 查询 2026年5月 月度汇总
curl "http://localhost:8000/api/v1/statistics/monthly-summary?year=2026&month=5"
# → {"year":2026,"month":5,"income":5300.0,"expense":352.0,"net":4948.0,"transaction_count":7}

# 查询 5月 支出分类分布
curl "http://localhost:8000/api/v1/statistics/by-category?start_date=2026-05-01&end_date=2026-05-31&direction=支出"
# → [{"category":"餐饮","amount":137.0,"count":3,"percentage":38.9}, ...]

# 查询上半年月度趋势
curl "http://localhost:8000/api/v1/statistics/trend?start_date=2026-01-01&end_date=2026-06-30&granularity=monthly"
# → [{"period":"2026-05","income":5300.0,"expense":352.0,"net":4948.0}, ...]
```

### 账单数据字段

| 字段 | 说明 |
|---|---|
| transaction_date | 交易日期/时间 |
| amount | 金额（支出为负，收入为正） |
| direction | 收支方向（支出/收入） |
| category | 所属分类名 |
| category_id | 关联分类表外键 |
| payee | 交易对方 |
| description | 商品/描述 |
| transaction_type | 交易类型 |
| payment_method | 支付方式 |
| transaction_status | 交易状态 |
| transaction_id | 交易单号 |
| merchant_order_id | 商户单号 |
| remark | 备注 |

### 全部 API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 欢迎页 |
| POST | `/api/v1/bills/` | 手动创建单条账单 |
| GET | `/api/v1/bills/` | 分页查询账单列表 |
| POST | `/api/v1/bills/upload` | 上传文件自动解析导入 |
| POST | `/api/v1/categories/` | 创建分类 |
| GET | `/api/v1/categories/` | 分类列表 |
| GET | `/api/v1/categories/{id}` | 分类详情 |
| PUT | `/api/v1/categories/{id}` | 更新分类 |
| DELETE | `/api/v1/categories/{id}` | 删除分类 |
| POST | `/api/v1/categories/match` | 文本自动匹配分类 |
| GET | `/api/v1/statistics/monthly-summary` | 月度收支汇总 |
| GET | `/api/v1/statistics/by-category` | 按分类统计 |
| GET | `/api/v1/statistics/trend` | 消费趋势 |
| POST | `/api/v1/chat/` | AI 对话（非流式） |
| POST | `/api/v1/chat/stream` | AI 对话（SSE 流式 + 工具进度） |

## 默认分类

| 分类 | 关键词示例 |
|---|---|
| 餐饮 | 餐厅, 外卖, 美食, 饭, 面, 火锅, 奶茶, 咖啡 |
| 交通 | 地铁, 公交, 打车, 滴滴, 高铁, 火车, 机票 |
| 购物 | 淘宝, 京东, 超市, 商场, 便利店 |
| 居住 | 房租, 物业, 水电, 燃气, 宽带 |
| 娱乐 | 电影, 游戏, 旅游, 运动, 健身 |
| 医疗 | 医院, 药, 门诊, 挂号, 体检 |
| 教育 | 书, 课程, 培训, 考试, 学费 |
| 通讯 | 手机, 话费, 流量, 充值 |
| 收入 | 工资, 奖金, 红包, 退款, 报销 |
| 其他 | （无关键词，作为兜底分类） |

## AI 对话记账

配置 LLM 后，可通过自然语言进行记账查询和记录。系统自动注入当前日期，LLM 无需猜测"今天"是哪天。

### 配置 LLM

在 `.env` 中设置 API Key（兼容任何 OpenAI API 格式服务）：

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1   # OpenAI / 智谱 / DeepSeek / Ollama
LLM_MODEL=gpt-4o-mini                        # 模型名称
PERSONA=buddy                                # 默认角色风格
```

支持的 LLM 服务：OpenAI / 智谱 GLM / DeepSeek / Ollama / LM Studio 等。

### 对话模式

| 端点 | 说明 |
|---|---|
| `POST /api/v1/chat/` | 非流式：等待完整回复后一次性返回 |
| `POST /api/v1/chat/stream` | SSE 流式：逐 token 推送，工具调用有进度提示 |

```bash
# 非流式对话
curl -X POST "http://localhost:8000/api/v1/chat/" \
  -H "Content-Type: application/json" \
  -d '{"message": "我这个月餐饮花了多少？"}'

# 流式对话（推荐前端使用）
curl -X POST "http://localhost:8000/api/v1/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "记一笔午餐麦当劳35元"}'
# → SSE 事件流: status → tool_call → reply_chunk... → done

# 多轮对话（传入 session_id）
curl -X POST "http://localhost:8000/api/v1/chat/" \
  -H "Content-Type: application/json" \
  -d '{"message": "晚餐花了80", "session_id": "abc123"}'
```

### 角色风格（Persona）

通过 `.env` 全局配置或请求中指定 `persona` 字段切换回复风格：

| persona | 名称 | 风格 |
|---|---|---|
| `buddy` | 毒舌搭子 | 幽默吐槽 + 网络热梗，自称"小账" |
| `cat` | 猫咪管家 | 傲娇喵星人，说话带"喵"，自称"本喵" |
| `analyst` | 财务分析师 | 严谨专业的数据风格，叫用户"老板" |
| `homie` | 老铁兄弟 | 东北腔铁哥们，"老铁"、"整挺好" |
| `custom` | 自定义 | 读取 `.env` 中 `PERSONA_CUSTOM` 的自定义 prompt |

```bash
# 请求中切换猫咪风格
curl -X POST "http://localhost:8000/api/v1/chat/" \
  -H "Content-Type: application/json" \
  -d '{"message": "今天我花了多少", "persona": "cat"}'
# → "喵~本喵帮你查了一下，今天花了235元喵！"
```

### 可调用的工具

| 工具 | 触发示例 |
|---|---|
| `query_bills` | "最近一周的账单"、"查五月份餐饮支出" |
| `create_bill` | "今天午餐花了35元"、"记录一笔收入5000" |
| `get_monthly_summary` | "这个月花了多少"、"五月份收支情况" |
| `get_category_breakdown` | "餐饮占比多少"、"各分类分布" |
| `get_trend` | "最近6个月的趋势"、"这周每天开销" |
| `list_categories` | "有哪些分类"、"可用的分类" |

### 速度优化

- 首次工具选择阶段 max_tokens=512，快速判断是否需要调工具
- 最终回复阶段 max_tokens=1024，保证回复质量
- System prompt 精简至 ~200 tokens，减少处理延迟

## 计划中的功能

- [x] **AI 记账对话** — LLM Function Calling + 流式输出 + Persona 角色系统
- [ ] **OCR 图片识别** — 上传账单截图自动识别交易信息
- [ ] **语音记账** — 语音输入转文字后自动生成账单记录
- [ ] **月度预算规划** — 基于历史消费数据 AI 生成下月预算建议
