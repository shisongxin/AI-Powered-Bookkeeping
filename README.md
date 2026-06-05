# BillAgent — AI-Powered Bookkeeping

智能记账助手APP，支持多格式账单文件导入、自动分类、统计分析、AI 对话、消费分析和预算规划功能。
![alt text](figure/image.png)
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
| Web 前端 | React 18 + TypeScript + Tailwind CSS + Axios |
| 测试 | pytest 8.3 + httpx |

## 项目结构

```
web/                             # Web 前端（React + Vite）
├── src/
│   ├── api/                     # Axios API 服务层 + JWT 拦截器
│   ├── types/                   # TypeScript 类型定义（对齐后端 Schema）
│   ├── components/Layout.tsx    # 响应式侧边栏布局 + 用户状态
│   └── pages/                   # 页面组件
│       ├── Dashboard.tsx        # 仪表盘：月度汇总卡片 + 分类分布 + 最近账单
│       ├── Bills.tsx            # 账单明细：分页列表 + 文件上传 + OCR识别 + 手动创建
│       ├── ChatPage.tsx         # AI 对话：SSE 流式 + 二次确认 + OCR + 工具状态卡片
│       ├── Analysis.tsx         # 流水分析：折线图(Recharts) + 环形饼图 + 预算执行
│       ├── Categories.tsx       # 分类管理：CRUD + 图标/颜色/关键词
│       ├── Login.tsx            # 登录页面
│       └── Register.tsx         # 注册页面
app/
├── main.py                    # FastAPI 应用入口
├── config.py                  # 配置管理（环境变量）
├── core/
│   ├── database.py            # 数据库引擎 & Session 管理
│   ├── auth.py                # 密码哈希 (bcrypt) + JWT 签发/验证
│   └── dependencies.py        # FastAPI 依赖注入 (get_current_user)
├── models/
│   ├── bill.py                # Bill ORM 模型（bills 表）
│   ├── category.py            # Category ORM 模型（categories 表）
│   ├── chat_session.py        # ChatSession ORM 模型（会话持久化）
│   └── user.py                # User ORM 模型（用户认证）
├── schemas/
│   ├── auth.py                # 认证 Pydantic 模型（注册/登录/Token/用户信息）
│   ├── bill.py                # Pydantic 模型（请求/响应 + 解析中间格式）
│   ├── category.py            # Category Pydantic 模型
│   ├── chat.py                # Chat 请求/响应模型
│   ├── ocr.py                 # OCR 识别响应模型
│   └── statistics.py          # 统计查询响应模型
├── services/
│   ├── bill_service.py        # 账单业务逻辑（创建、导入、去重、自动分类）
│   ├── category_service.py    # 分类业务逻辑（CRUD + 关键词自动匹配）
│   ├── chat_service.py        # AI 对话编排（LLM 调用 + 工具执行）
│   ├── chat_session_service.py # 会话持久化（DB 读写 + TTL 压缩）
│   ├── ocr_service.py         # OCR 服务（vision LLM 提取交易）
│   ├── tool_definitions.py    # 7 个工具的 OpenAI function calling 定义
│   ├── personas.py            # 角色预设（4 种风格 + 自定义）
│   └── statistics_service.py  # 统计业务逻辑（月度汇总、分类饼图、趋势）
├── api/v1/endpoints/
│   ├── auth.py                # 认证端点（注册/登录/个人信息）
│   ├── bills.py               # 账单 CRUD + 文件上传解析
│   ├── categories.py          # 分类 CRUD + 自动匹配
│   ├── statistics.py          # 统计查询（月度汇总/分类饼图/消费趋势）
│   ├── chat.py                # AI 对话（非流式 + SSE 流式）
│   └── ocr.py                 # OCR 图片识别
└── utils/
    ├── bill_parser.py          # 通用账单解析器（Excel/CSV/PDF）
    ├── wechat_parser.py        # 微信账单专用解析器
    ├── alipay_parser.py        # 支付宝账单专用解析器
    └── image_utils.py          # 图片验证/压缩/base64
alembic/
├── env.py                     # Alembic 环境配置（读取项目 DB URL）
└── versions/                  # 迁移脚本目录
tests/
├── conftest.py                # 共享 fixtures（SQLite + TestClient）
├── test_parsers.py            # 解析器测试（3 个用例）
├── test_categories.py         # 分类系统测试（30 个用例）
├── test_statistics.py         # 统计 API 测试（12 个用例）
├── test_chat.py               # AI 对话测试（31 个用例）
├── test_auth.py               # 认证测试（13 个用例）
└── test_ocr.py                # OCR 测试（13 个用例）
init_db.py                     # 数据库初始化（Alembic 迁移 + 种子数据）
requirements.txt               # Python 依赖
```

## 快速开始

### 1. 环境准备

- Python 3.10+
- PostgreSQL（默认连接 `postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/bill_db`）

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

编辑 `.env` 文件，按需修改数据库连接等配置：

```env
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/bill_db

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

### 6. 启动 Web 前端

```bash
cd web
npm install              # 安装依赖（需 Node.js 18+）
npm run dev              # 启动开发服务器 → http://localhost:3000
```

前端通过 Vite 代理 `/api/*` 到 `http://localhost:8000`，无需额外配置。

**前端页面**：
| 页面 | 路径 | 功能 |
|---|---|---|
| 登录 | `/login` | 用户登录，JWT 令牌存储到 localStorage |
| 注册 | `/register` | 新用户注册（含表单验证），成功后跳转登录 |
| 仪表盘 | `/` | 月度收支汇总卡片 + 分类分布进度条 + 最近5笔账单 |
| 账单明细 | `/bills` | 分页列表（时间倒序）+ CSV/Excel/PDF 上传解析 + 图片 OCR 识别记账 + 手动创建 |
| AI 记账 | `/chat` | SSE 流式对话 + 二次确认模式 + 可编辑确认卡片 + 角色切换 + OCR 识别 + 实时状态指示器 |
| 流水分析 | `/analysis` | 收支折线图(Recharts) + 分类环形饼图 + 预算 vs 实际执行（三色状态） |
| 分类管理 | `/categories` | 分类 CRUD + 图标/颜色/关键词管理 |

### 7. 运行测试

```bash
pytest tests/ -v
```

当前 119 个测试用例，覆盖分类 CRUD、自动分类、账单导入、统计查询、AI 对话、工具调用、流式输出、角色预设、会话持久化、用户认证、OCR 图片识别、月度预算等全部功能。

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
| POST | `/api/v1/chat/stream` | AI 对话（SSE 流式 + 工具进度 + 二次确认） |
| POST | `/api/v1/chat/confirm` | 确认/取消待处理的 create_bill |
| POST | `/api/v1/auth/register` | 用户注册 |
| POST | `/api/v1/auth/login` | 用户登录 |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| POST | `/api/v1/ocr/recognize` | OCR 图片识别（上传截图提取交易） |
| POST | `/api/v1/budgets/` | 创建/覆盖预算 |
| GET | `/api/v1/budgets/?year=&month=` | 查询月度预算 |
| PUT | `/api/v1/budgets/{id}` | 更新预算 |
| DELETE | `/api/v1/budgets/{id}` | 删除预算 |
| GET | `/api/v1/budgets/vs-actual?year=&month=` | 预算 vs 实际对比 |
| GET | `/api/v1/budgets/suggest?year=&month=` | AI 预算建议 |

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

### 用户认证系统

支持 JWT 用户注册/登录，为多用户数据隔离打下基础。当前端点无需认证即可使用（向后兼容）。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/auth/register` | 注册新用户，返回 JWT token |
| POST | `/api/v1/auth/login` | 用户登录，返回 JWT token |
| GET | `/api/v1/auth/me` | 获取当前用户信息（需 Authorization 头） |

```bash
# 注册
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"secret123"}'

# 登录
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"secret123"}'

# 获取个人信息
curl "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer <token>"
```

### OCR 图片识别

上传账单截图或收据照片，vision LLM 自动提取交易日期、金额、商户名等结构化数据。基于智谱 GLM-4V（可配置为 GPT-4o 等其他多模态模型）。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ocr/recognize` | 上传图片，返回提取的交易列表 |

```bash
# 上传收据图片
curl -X POST "http://localhost:8000/api/v1/ocr/recognize" \
  -F "file=@receipt.jpg"
# → {"success":true,"items":[{"payee":"麦当劳","amount":-35.0,...}]}
```

**模型选择**：通过 `.env` 配置 `VISION_MODEL` 切换多模态模型：
```env
VISION_MODEL=glm-4v        # 智谱 GLM-4V（默认，推荐中文场景）
# VISION_MODEL=gpt-4o      # OpenAI GPT-4o（需切换 OPENAI_BASE_URL）
```

支持的图片格式：PNG / JPG / WebP，最大 10MB，自动压缩大图。

**Chat 集成**：通过 ChatRequest 的 `image_base64` 字段，可直接在对话中上传图片，LLM 自动完成"OCR 识别 → 逐条记账"全链路（Tool Chaining）：
```bash
curl -X POST "http://localhost:8000/api/v1/chat/" \
  -H "Content-Type: application/json" \
  -d '{"message":"识别并记账","image_base64":"...","persona":"buddy"}'
# → scan_receipt → create_bill × N → 自然语言回复
```

**统一时间锚点**：ChatService 入口锁定系统时间，传递给 System Prompt + OCRService，确保 LLM 日期推理与 OCR 使用同一时间基准，杜绝重复 `datetime.now()` 调用。

### 月度预算规划

设置月度分类预算，实时对比实际支出，AI 基于历史数据生成建议。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/budgets/` | 创建/覆盖预算（同年月+分类唯一） |
| GET | `/api/v1/budgets/?year=&month=` | 查询月度预算列表 |
| PUT | `/api/v1/budgets/{id}` | 更新预算金额或备注 |
| DELETE | `/api/v1/budgets/{id}` | 删除预算 |
| GET | `/api/v1/budgets/vs-actual?year=&month=` | 预算 vs 实际对比（含状态） |
| GET | `/api/v1/budgets/suggest?year=&month=` | AI 预算建议（近3月历史） |

**消耗状态**：`正常`(<80%) → `接近上限`(80-100%) → `已超支`(>100%) → `无预算`

```bash
# 设置预算
curl -X POST "http://localhost:8000/api/v1/budgets/" \
  -H "Content-Type: application/json" \
  -d '{"year":2026,"month":6,"category":"餐饮","amount":3000}'

# 预算 vs 实际
curl "http://localhost:8000/api/v1/budgets/vs-actual?year=2026&month=6"
# → {"items":[{"category":"餐饮","budget":3000,"actual":450,"remaining":2550,"percentage":15.0,"status":"正常"}],...}

# AI 建议
curl "http://localhost:8000/api/v1/budgets/suggest?year=2026&month=7"
# → [{"category":"餐饮","suggested_amount":3300.0,"reason":"月均3000，上浮10%缓冲"},...]
```

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
| `scan_receipt` | 收到账单截图后自动调用，提取交易再逐条 create_bill |
| `get_budget_status` | "预算还剩多少"、"哪个分类超支了" |
| `suggest_budget` | "下个月预算设多少合适" |

### 二次确认模式

AI 记账支持二次确认，防止 LLM 误创建账单。通过 ChatRequest 的 `confirm_mode: true` 开启（Web 前端默认开启）：

```
用户: "午餐麦当劳35元"
  → SSE: status("正在分析...")
  → SSE: tool_call(create_bill) → 🔒 暂停，不执行
  → SSE: confirm_required({tool_name, arguments})
  → SSE: done(pending_confirmation: true)

前端显示确认卡片：
  ├── 查看账单详情
  ├── [修改] → 可编辑表单（支持分类下拉选择）
  ├── [确认记账] → POST /chat/confirm {action: "confirm"}
  └── [取消] → POST /chat/confirm {action: "reject"}
```

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/chat/confirm` | 确认/取消待处理的 create_bill 操作 |

### 速度优化

- 工具选择阶段 max_tokens=2048（适配 DeepSeek 等推理模型的 thinking token 开销）
- 最终回复阶段 max_tokens=4096 + 流式输出（逐 token 推送）
- System prompt 精简至 ~200 tokens，减少处理延迟
- 状态提示原地更新（不累积到消息内容中）

## 计划中的功能

- [x] **AI 记账对话** — LLM Function Calling + 流式输出 + Persona 角色系统
- [x] **OCR 图片识别** — 上传账单截图自动识别交易信息
- [x] **月度预算规划** — 预算 CRUD + vs-actual 对比 + AI 预算建议
- [x] **用户认证系统** — JWT 注册/登录 + bcrypt 密码哈希
- [x] **Web 前端** — React 18 + TypeScript + Tailwind CSS + Recharts 图表
- [x] **二次确认记账** — create_bill 暂停等待用户确认/修改/取消
- [x] **AI 状态实时更新** — 状态提示原地更新不累积
- [x] **分类管理页面** — 前端分类 CRUD + 图标/颜色/关键词
- [x] **会话持久化** — 切换页面保留对话（localStorage）+ 后端 TTL 7天
- [ ] 语音记账 — Whisper API 语音转文字
- [ ] Docker 部署 — docker-compose 一键启动
- [ ] App 前端 — React Native / Flutter
