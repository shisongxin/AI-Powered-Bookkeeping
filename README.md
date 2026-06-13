# BillAgent — AI-Powered Bookkeeping

智能记账助手APP，支持多格式账单文件导入、自动分类、统计分析、AI 对话记账、消费分析和预算规划功能。同时支持 **Web 端** 和 **微信小程序** 两种形态。

**安全修复版本：v1.1（2026-06-13）**
- ✅ 多用户数据隔离（C1）
- ✅ JWT 配置修复（C2）
- ✅ 认证全覆盖（C3）
- ✅ 速率限制（C4）
- ✅ 审计日志（C9）
- ✅ 默认分类功能

![alt text](figure/loginpage.png)
![alt text](figure/analysispage.png)
![alt text](figure/image.png)

主要亮点：RAG+Agent记账 + 多用户数据隔离 + 微信登录态认证 + 全链路安全防护

前端界面视频演示：

1、流水分析版块：https://github.com/user-attachments/assets/78ffcaaa-a0ce-4842-8cb0-1c02ed3ad37f

2、账单明细版块：https://github.com/user-attachments/assets/6bef2222-f127-4df6-be85-ddaf0ac2c143

3、AI记账版块：https://github.com/user-attachments/assets/48ee38ce-25ae-49f5-9014-df85e9e363c1

4、分类管理版块：https://github.com/user-attachments/assets/864d9f8e-3c1d-4559-aa11-8b1fea02009a

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
| 微信小程序 | WXML + WXSS + JS（原生小程序） |
| 认证体系 | JWT + 微信 openid（双模式） |
| 速率限制 | 滑动窗口算法（IP + 用户双维度） |
| 审计日志 | 结构化 JSON 日志 |
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
│       ├── Analysis.tsx         # 流水分析：月度汇总 + 趋势折线图 + 分类饼图/条状图切换 + 预算执行
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
│   ├── dependencies.py        # FastAPI 依赖注入 (get_current_user)
│   ├── rate_limiter.py        # 滑动窗口限流器
│   └── audit.py               # 审计日志服务
├── models/
│   ├── bill.py                # Bill ORM 模型（bills 表）
│   ├── category.py            # Category ORM 模型（categories 表）
│   ├── chat_session.py        # ChatSession ORM 模型（会话持久化）
│   └── user.py                # User ORM 模型（用户认证 + openid）
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
│   ├── statistics_service.py  # 统计业务逻辑（月度汇总、分类饼图、趋势）
│   └── default_categories.py  # 默认分类服务（新建用户自动创建）
├── api/v1/endpoints/
│   ├── auth.py                # 认证端点（注册/登录/个人信息）
│   ├── bills.py               # 账单 CRUD + 文件上传解析
│   ├── categories.py          # 分类 CRUD + 自动匹配 + 默认分类
│   ├── statistics.py          # 统计查询（月度汇总/分类饼图/消费趋势）
│   ├── chat.py                # AI 对话（非流式 + SSE 流式）
│   └── ocr.py                 # OCR 图片识别
├── middleware/
│   └── rate_limit_middleware.py # 速率限制中间件
└── utils/
    ├── bill_parser.py          # 通用账单解析器（Excel/CSV/PDF）
    ├── wechat_parser.py        # 微信账单专用解析器
    ├── alipay_parser.py        # 支付宝账单专用解析器
    └── image_utils.py          # 图片验证/压缩/base64
alembic/
├── env.py                     # Alembic 环境配置
└── versions/                  # 迁移脚本目录
tests/
├── conftest.py                # 共享 fixtures
├── test_parsers.py            # 解析器测试
├── test_categories.py         # 分类系统测试
├── test_statistics.py         # 统计 API 测试
├── test_chat.py               # AI 对话测试
├── test_auth.py               # 认证测试
├── test_ocr.py                # OCR 测试
├── test_bill_crud.py          # 账单更新/搜索测试
└── test_content_blocks.py     # 内容块解析测试
scripts/
├── clear_database.py          # 清空数据库（测试用）
├── fix_duplicate_session_keys.py # 修复重复 session_key
└── fix_all_endpoints.py       # 批量修复端点
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

编辑 `.env` 文件：

```env
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/bill_db

# JWT 认证配置
JWT_SECRET_KEY=your-super-secret-key-min-32-chars
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# LLM 配置（支持 OpenAI / 智谱 / DeepSeek / Ollama 等兼容服务）
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# 角色预设（可选: buddy / cat / analyst / homie / custom）
PERSONA=buddy

# 微信小程序配置（可选）
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
```

**环境变量说明**：

| 变量 | 必需 | 说明 |
|---|---|---|
| DATABASE_URL | 是 | 数据库连接字符串 |
| JWT_SECRET_KEY | 是 | JWT 密钥（至少 32 字符） |
| OPENAI_API_KEY | 是 | LLM API Key |
| OPENAI_BASE_URL | 是 | LLM API 地址 |
| LLM_MODEL | 是 | LLM 模型名称 |
| PERSONA | 否 | 角色风格（默认 buddy） |
| WECHAT_APPID | 否 | 微信小程序 AppID |
| WECHAT_SECRET | 否 | 微信小程序 AppSecret |

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
npm install
npm run dev
```

### 7. 运行测试

```bash
pytest tests/ -v
```

## 安全特性

### 认证体系

支持 **双模式认证**：Web 端 JWT 用户名/密码 + 微信小程序 openid 登录态。

| 特性 | Web 端 | 微信小程序 |
|---|---|---|
| 认证方式 | JWT + 用户名/密码 | JWT + openid |
| 登录端点 | `/api/v1/auth/login` | `/api/v1/wechat/login` |
| 认证 Header | `Authorization: Bearer <token>` | `X-Wechat-Openid: <openid>` |
| 用户创建 | 显式注册 | 首次调用 API 自动创建 |
| 数据隔离 | 按 user_id 隔离 | 按 openid 隔离 |

### 速率限制

滑动窗口限流算法，不同端点类型使用不同策略：

| 端点类型 | 限制 | 说明 |
|----------|------|------|
| `/auth/*` | 10次/分钟 | 防暴力破解 |
| `/chat/*` | 20次/分钟 | 保护 AI API |
| `/ocr/*` | 30次/分钟 | 保护 OCR 服务 |
| 其他 | 60次/分钟 | 正常使用 |

### 审计日志

记录所有敏感操作到 `logs/audit.log`：
- 登录/登出/注册
- 账单创建/更新/删除
- 分类创建/更新/删除
- 预算创建/更新/删除
- AI 对话
- OCR 请求

## 已实现功能

### 默认分类（v1.1 新增）

用户注册时自动创建 10 个常用分类，降低上手门槛。

| 分类 | 关键词示例 |
|---|---|
| 餐饮 | 餐厅, 外卖, 美食, 火锅, 奶茶, 咖啡 |
| 交通 | 打车, 公交, 地铁, 加油, 停车 |
| 购物 | 超市, 商场, 网购, 衣服, 鞋子 |
| 娱乐 | 电影, 游戏, KTV, 旅游, 健身 |
| 居住 | 房租, 水电, 物业, 宽带, 话费 |
| 医疗 | 医院, 药品, 体检, 挂号, 医保 |
| 教育 | 学费, 书本, 培训, 课程, 考试 |
| 工资 | 工资, 奖金, 报销, 退款, 收入 |
| 转账 | 转账, 红包, 还款, 借款, 收款 |
| 其他 | （无关键词，作为兜底分类） |

**API 端点：**
- `POST /api/v1/auth/register` - 注册时自动创建默认分类
- `POST /api/v1/categories/reset` - 重置为默认分类
- `GET /api/v1/categories/defaults` - 获取默认分类配置

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
| POST | `/api/v1/categories/reset` | 重置为默认分类 |
| GET | `/api/v1/categories/defaults` | 获取默认分类配置 |

### 账单文件上传 & 自动解析

`POST /api/v1/bills/upload` — 上传账单文件，自动识别格式、解析、分类、去重、入库。

- 支持 CSV / Excel (.xlsx, .xls) / PDF
- 自动识别文件编码、表头行位置、字段映射
- 解析后自动匹配分类，基于交易单号或日期+金额+对方去重

### 统计数据 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/statistics/monthly-summary` | 月度收支汇总 |
| GET | `/api/v1/statistics/by-category` | 按分类统计（饼图数据） |
| GET | `/api/v1/statistics/trend` | 消费趋势（daily/weekly/monthly） |

### 月度预算规划

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/budgets/` | 创建/覆盖预算 |
| GET | `/api/v1/budgets/` | 查询月度预算 |
| PUT | `/api/v1/budgets/{id}` | 更新预算 |
| DELETE | `/api/v1/budgets/{id}` | 删除预算 |
| GET | `/api/v1/budgets/vs-actual` | 预算 vs 实际对比 |
| GET | `/api/v1/budgets/suggest` | AI 预算建议 |
| POST | `/api/v1/budgets/auto-generate` | 自动生成预算 |

### AI 对话记账

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/chat/` | AI 对话（非流式） |
| POST | `/api/v1/chat/stream` | AI 对话（SSE 流式） |
| POST | `/api/v1/chat/confirm` | 确认/取消待处理的 create_bill |

### 全部 API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 欢迎页 |
| POST | `/api/v1/bills/` | 手动创建单条账单 |
| GET | `/api/v1/bills/` | 分页查询账单列表 |
| PUT | `/api/v1/bills/{id}` | 更新账单 |
| DELETE | `/api/v1/bills/{id}` | 删除账单 |
| GET | `/api/v1/bills/search` | 搜索账单 |
| POST | `/api/v1/bills/upload` | 上传文件自动解析导入 |
| POST | `/api/v1/categories/` | 创建分类 |
| GET | `/api/v1/categories/` | 分类列表 |
| GET | `/api/v1/categories/{id}` | 分类详情 |
| PUT | `/api/v1/categories/{id}` | 更新分类 |
| DELETE | `/api/v1/categories/{id}` | 删除分类 |
| POST | `/api/v1/categories/match` | 文本自动匹配分类 |
| POST | `/api/v1/categories/reset` | 重置为默认分类 |
| GET | `/api/v1/categories/defaults` | 获取默认分类配置 |
| GET | `/api/v1/statistics/monthly-summary` | 月度收支汇总 |
| GET | `/api/v1/statistics/by-category` | 按分类统计 |
| GET | `/api/v1/statistics/trend` | 消费趋势 |
| POST | `/api/v1/chat/` | AI 对话（非流式） |
| POST | `/api/v1/chat/stream` | AI 对话（SSE 流式） |
| POST | `/api/v1/chat/confirm` | 确认/取消待处理的 create_bill |
| POST | `/api/v1/auth/register` | 用户注册（自动创建默认分类） |
| POST | `/api/v1/auth/login` | 用户登录 |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| POST | `/api/v1/ocr/recognize` | OCR 图片识别 |
| POST | `/api/v1/budgets/` | 创建/覆盖预算 |
| GET | `/api/v1/budgets/` | 查询月度预算 |
| PUT | `/api/v1/budgets/{id}` | 更新预算 |
| DELETE | `/api/v1/budgets/{id}` | 删除预算 |
| GET | `/api/v1/budgets/vs-actual` | 预算 vs 实际对比 |
| GET | `/api/v1/budgets/suggest` | AI 预算建议 |
| POST | `/api/v1/budgets/auto-generate` | 自动生成预算 |

## 数据库迁移

### 迁移脚本

| 版本 | 说明 | 主要变更 |
|---|---|---|
| `0338cffdfef1` | 初始版本 | 创建 categories、bills 表 |
| `b9aab5c0bb03` | 添加会话 | 创建 chat_sessions 表 |
| `dc9f7ff0ddf4` | 添加用户 | 创建 users 表 |
| `1d6ed0d05c43` | 添加预算 | 创建 budgets 表 |
| `20260612_add_user_id` | 用户数据隔离 | 添加 user_id 外键、索引、默认分类 |

### 常用命令

```bash
# 生成新迁移
alembic revision --autogenerate -m "描述"

# 应用迁移到最新版本
alembic upgrade head

# 回滚一个版本
alembic downgrade -1

# 查看迁移历史
alembic history
```

## 多用户数据隔离

所有账单、预算、会话数据按用户隔离，支持多用户同时使用。

### 数据模型

| 模型 | 用户隔离字段 | 说明 |
|---|---|---|
| User | `openid`（微信）/ `username`（Web） | 用户唯一标识 |
| Bill | `user_id`（外键） | 账单关联用户 |
| Budget | `user_id`（外键） | 预算关联用户 |
| ChatSession | `user_id`（外键，可为空） | 会话关联用户，支持匿名会话 |
| Category | `user_id`（外键） | 分类关联用户（v1.1 新增） |

### 唯一约束

| 表 | 唯一约束 | 说明 |
|---|---|---|
| Bill | `transaction_id` | 交易单号唯一 |
| Budget | `user_id + year + month + category` | 同用户同月同分类预算唯一 |
| ChatSession | `session_key` | 会话标识唯一 |
| User | `openid` / `username` / `email` | 用户标识唯一 |

## 计划中的功能

- [x] **AI 记账对话** — LLM Function Calling + 流式输出 + Persona 角色系统
- [x] **OCR 图片识别** — 上传账单截图自动识别交易信息
- [x] **月度预算规划** — 预算 CRUD + vs-actual 对比 + AI 预算建议
- [x] **用户认证系统** — JWT 注册/登录 + bcrypt 密码哈希
- [x] **Web 前端** — React 18 + TypeScript + Tailwind CSS + Recharts 图表
- [x] **批量确认记账** — 一次对话识别多条账单，统一确认卡片
- [x] **AI 状态实时更新** — 状态提示原地更新不累积
- [x] **账单搜索与编辑** — 关键词/分类/日期搜索 + 行内编辑
- [x] **分类管理页面** — 前端 CRUD + 30 预设图标 + 吸色盘
- [x] **会话持久化** — 切换页面保留对话 + 后端 TTL 7天
- [x] **实时时间注入** — 每次对话刷新 system prompt 日期
- [x] **预算自动生成** — 基于上月消费自动生成当月预算
- [x] **前端 UI 升级** — Warm Ledger 主题
- [x] **PaddleOCR 本地引擎** — 免费离线 OCR
- [x] **账单删除** — 后端 API + 前端删除
- [x] **多用户数据隔离** — 账单/预算/会话按用户隔离
- [x] **微信小程序认证** — 支持 openid 登录
- [x] **认证全覆盖** — 所有端点支持 JWT + 微信 openid
- [x] **速率限制** — 滑动窗口限流（IP + 用户双维度）
- [x] **审计日志** — 记录所有敏感操作
- [x] **默认分类** — 新用户自动创建 10 个常用分类
- [ ] 语音记账 — Whisper API 语音转文字
- [ ] Docker 部署 — docker-compose 一键启动
- [ ] App 前端 — React Native / Flutter

---

*最后更新：2026-06-13*
*版本：v1.1（安全修复版）*
