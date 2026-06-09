# BillAgent — AI-Powered Bookkeeping

智能记账助手APP，支持多格式账单文件导入、自动分类、统计分析、AI 对话记账、消费分析和预算规划功能。
![alt text](figure/loginpage.png)
![alt text](figure/analysispage.png)
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
│   ├── components/
│   │   ├── Layout.tsx                # 侧边栏布局 + 用户头像（Warm Ledger 主题）
│   │   └── ContentBlockRenderer.tsx  # 结构化内容块渲染器（7 种块类型）
│   └── pages/                   # 页面组件
│       ├── Analysis.tsx         # 流水分析：月度汇总 + 趋势折线图 + 分类饼图/条状图切换 + 预算执行(手动设置/隐藏分类)
│       ├── Bills.tsx            # 账单明细：按月折叠卡片 + 搜索 + 行内编辑 + 文件上传 + OCR
│       ├── ChatPage.tsx         # AI 对话：SSE 流式 + 批量确认 + 可编辑账单 + 角色切换 + 实时状态
│       ├── Categories.tsx       # 分类管理：卡片网格 + 图标选择器 + 吸色盘
│       ├── Login.tsx            # 登录页面（分屏品牌布局）
│       └── Register.tsx         # 注册页面（功能列表展示）
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
├── test_ocr.py                # OCR 测试（13 个用例）
├── test_bill_crud.py          # 账单更新/搜索测试（11 个用例）
└── test_content_blocks.py     # 内容块解析 + 混合路由测试（7 个用例）
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
| 流水分析 | `/analysis` | 月度汇总卡片 + 收支折线图 + 分类饼图/条状图切换 + 预算执行（手动设置/隐藏分类/智能生成） |
| 账单明细 | `/bills` | 按月折叠卡片（含收入/支出/结余汇总）+ 搜索过滤 + 行内编辑 + 文件上传解析 + OCR 识别 |
| AI 记账 | `/chat` | SSE 流式对话 + 批量确认模式 + 每条可编辑 + 角色切换 + OCR + 实时状态指示器（原地更新） |
| 分类管理 | `/categories` | 卡片网格 CRUD + 30 预设图标下拉 + 吸色盘 + 关键词管理 |

### 7. 运行测试

```bash
pytest tests/ -v
```

当前 168 个测试用例（含 PaddleOCR 28 个提取逻辑测试），覆盖分类 CRUD、自动分类、账单导入/更新/搜索、统计查询、AI 对话、工具调用、流式输出、JSON 内容块解析、混合路由、批量确认、角色预设、会话持久化、用户认证、OCR 图片识别、月度预算等全部功能。

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

**自动分类机制**：每个分类维护一组关键词（逗号分隔），导入账单时遍历所有分类取最高匹配度。无法匹配则回退到 `transaction_type` 或"其他"。

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
| GET | `/api/v1/bills/` | 分页查询账单列表（时间倒序） |
| PUT | `/api/v1/bills/{id}` | 更新账单（部分字段） |
| DELETE | `/api/v1/bills/{id}` | 删除账单 |
| GET | `/api/v1/bills/search?keyword=&category=&start_date=&end_date=` | 搜索账单（关键词/分类/日期） |
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
| POST | `/api/v1/budgets/auto-generate?year=&month=` | 基于上月消费自动生成预算（上浮10%） |

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

双重引擎架构：优先使用 **PaddleOCR** 本地引擎（免费、精准），不可用时自动回退到 **Vision LLM**（智谱 GLM-4V / GPT-4o）。

| 引擎 | 原理 | 优势 | 限制 |
|---|---|---|---|
| PaddleOCR | 本地 OCR 模型 → 文本检测 → 正则提取 | 免费、离线、精准 | 需安装 `paddlepaddle` |
| Vision LLM | 多模态大模型 → JSON 结构化输出 | 理解力强、无需安装 | 需 API Key |

**提取能力**：金额（¥/-符号/元后缀）、商户名（OCR 位置推断）、日期（完整/短格式）、分类（关键词匹配）、支付方式（微信/支付宝/银行卡）。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ocr/recognize` | 上传图片（PNG/JPG/WebP，≤10MB），返回结构化交易列表 |

```bash
# 上传收据图片（自动选择引擎）
curl -X POST "http://localhost:8000/api/v1/ocr/recognize" \
  -F "file=@receipt.jpg"
# → {"success":true,"items":[{"payee":"麦当劳","amount":-35.0,"category":"餐饮",...}]}
```

**安装 PaddleOCR**（推荐，获得最佳识别效果）：
```bash
# 推荐稳定版本（Windows/Linux 均可用）
pip install paddlepaddle==2.6.2 paddleocr==2.7.3 "numpy<2"
```
> ⚠️ PaddleOCR 3.x + PaddlePaddle 3.x 在 Windows 上存在 OneDNN/PIR 兼容性问题（`ConvertPirAttribute2RuntimeAttribute`），请使用上述 2.x 版本。

**Vision LLM 配置**（PaddleOCR 不可用时的回退方案）：
```env
VISION_MODEL=glm-4v        # 智谱 GLM-4V（默认）
# VISION_MODEL=gpt-4o      # OpenAI GPT-4o
OPENAI_API_KEY=sk-xxx      # 必须配置
OPENAI_BASE_URL=https://api.openai.com/v1
```

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

# 自动生成预算（基于上月消费数据，上浮 10%）
curl -X POST "http://localhost:8000/api/v1/budgets/auto-generate?year=2026&month=6"
# → [{"id":1,"year":2026,"month":6,"category":"餐饮","amount":550.0,...}]
```
**自动生成逻辑**：分析上月各分类实际支出 → 上浮 10% 作为缓冲 → 跳过已有预算的分类 → 批量入库。上月无消费数据时返回空列表。前端 Analysis 页面提供「⚡ 智能生成」按钮一键触发。

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
| `POST /api/v1/chat/stream` | SSE 流式：status / tool_call / confirm_required / reply_chunk / content_block / done |

```bash
# 非流式对话
curl -X POST "http://localhost:8000/api/v1/chat/" \
  -H "Content-Type: application/json" \
  -d '{"message": "我这个月餐饮花了多少？"}'

# 流式对话（推荐前端使用）
curl -X POST "http://localhost:8000/api/v1/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "记一笔午餐麦当劳35元"}'
# → SSE 事件流: status → tool_call → reply_chunk | content_block → done

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

### 批量确认模式

AI 支持在一次对话中识别多条账单，统一发送确认卡片。用户可逐条编辑每笔记账后统一确认：

```
用户: "午餐麦当劳35元，晚餐外卖50元，打车25元"
  → SSE: tool_call(list_categories) → 自动执行
  → SSE: tool_call(create_bill) × 3 → 🔒 全部暂不执行
  → SSE: confirm_required {bills: [{...}, {...}, {...}]}
  → SSE: done(pending_confirmation: true)

前端显示批量确认卡片：
┌──────────────────────────────────┐
│ ⚠ 确认 3 笔记账？         AI 生成 │
├──────────────────────────────────┤
│ #1 麦当劳  −35.00 元  [✏️ 编辑] │
│ #2 外卖    −50.00 元  [✏️ 编辑] │
│ #3 滴滴    −25.00 元  [✏️ 编辑] │
├──────────────────────────────────┤
│     [✅ 确认全部]   [取消全部]    │
└──────────────────────────────────┘
```

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/chat/confirm` | 确认/取消待处理的批量 create_bill（支持 modified_arguments 数组） |

### 实时时间注入

每次对话（包括恢复已有会话）自动刷新 system prompt 中的当前日期。无论会话是今天新建还是上周创建，AI 始终看到实时日期，确保"今天/本月"等自然语言被正确解析。

### 混合渲染架构

对话内容采用双路径渲染策略：

```
LLM 回复 → _parse_content_blocks() → 判断内容类型
  ├─ 含结构化块(table/summary/bill_list) → content_block SSE → ContentBlockRenderer
  └─ 纯文本/Markdown → reply_chunk SSE → ReactMarkdown + remarkGfm
```

**结构化内容块类型**：

| type | 说明 | 前端组件 |
|---|---|---|
| `text` | 纯文本段落 | `<TextView>` |
| `heading` | 标题 (level 1-3) | `<HeadingView>` |
| `table` | 数据表格 (headers + rows) | `<TableView>` |
| `summary` | 摘要卡片 (label/value/trend) | `<SummaryView>` |
| `bill_list` | 账单条目列表 | `<BillListView>` |
| `callout` | 提示框 (info/warning/success) | `<CalloutView>` |
| `divider` | 分割线 | `<hr>` |

**后端容错**：JSON 解析失败时自动回退为 Markdown 渲染，保证降级可用。

### 前端设计系统

**Warm Ledger 主题** — 暖金色调的金融记账风格：

| 层级 | 配色 |
|---|---|
| 主色 (Gold) | `#f59e0b` → `#b45309`（温暖、信任、价值感） |
| 深色 (Espresso) | `#faf7f5` → `#0f0d0b`（文本、表面、深色模式） |
| 收入 (Emerald) | `#10b981` — 翠绿 |
| 支出 (Coral) | `#f04444` — 珊瑚红 |

**字体**：Georgia（标题 serif）+ PingFang SC（正文 sans-serif）

**动效**：fadeIn / slideUp / scaleIn / shimmer / pulseSoft — CSS 动画，无 JS 依赖

**组件类**：`glass-card`（玻璃拟态卡片）、`stat-card`（统计卡片）、`btn-primary/secondary`（按钮）、`input-field`（输入框）、`chat-bubble-user/ai`（聊天气泡）

### 速度优化

- 工具选择阶段 max_tokens=2048（适配 DeepSeek 等推理模型的 thinking token 开销）
- 最终回复阶段 max_tokens=4096 + 流式输出（逐 token 推送）
- System prompt 精简至 ~200 tokens，减少处理延迟
- 状态提示原地更新（不累积到消息内容中）
- 批量工具调用：同批次非 create_bill 工具直接执行，create_bill 统一收集后一次性确认

## 计划中的功能

- [x] **AI 记账对话** — LLM Function Calling + 流式输出 + Persona 角色系统
- [x] **OCR 图片识别** — 上传账单截图自动识别交易信息
- [x] **月度预算规划** — 预算 CRUD + vs-actual 对比 + AI 预算建议
- [x] **用户认证系统** — JWT 注册/登录 + bcrypt 密码哈希
- [x] **Web 前端** — React 18 + TypeScript + Tailwind CSS + Recharts 图表
- [x] **批量确认记账** — 一次对话识别多条账单，统一确认卡片，逐条可编辑
- [x] **AI 状态实时更新** — 状态提示原地更新不累积
- [x] **账单搜索与编辑** — 关键词/分类/日期搜索 + 行内编辑更新
- [x] **分类管理页面** — 前端 CRUD + 30 预设图标 + 吸色盘
- [x] **会话持久化** — 切换页面保留对话（localStorage）+ 后端 TTL 7天
- [x] **实时时间注入** — 每次对话刷新 system prompt 日期
- [x] **预算自动生成** — 基于上月消费自动生成当月预算（上浮 10%）
- [x] **前端 UI 升级** — Warm Ledger 主题（暖金+深咖啡+玻璃拟态）
- [x] **PaddleOCR 本地引擎** — 免费离线 OCR，精准提取金额/商户/日期/分类，不可用时自动回退 Vision LLM
- [x] **账单删除** — 后端 DELETE API + 前端账单明细行删除 + AI 记账批量确认中逐条忽略
- [ ] 语音记账 — Whisper API 语音转文字
- [ ] Docker 部署 — docker-compose 一键启动
- [ ] App 前端 — React Native / Flutter
