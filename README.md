# BillAgent — AI-Powered Bookkeeping <img src="figure/logo.jpg" width="30"/>

<div align="center">

> 智能记账助手 APP，支持多格式账单文件导入、自动分类、统计分析、AI 对话记账、消费分析和预算规划。同时支持 **Web 端** 和 **微信小程序** 两种形态，账号体系统一，数据实时同步。

[![Tech](https://img.shields.io/badge/FastAPI-0.115-009688)](https://fastapi.tiangolo.com)
[![Tech](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev)
[![Tech](https://img.shields.io/badge/Taro-3.6-2CA5E0)](https://taro.jd.com)
[![Tech](https://img.shields.io/badge/PostgreSQL-15-336791)](https://www.postgresql.org)
[![Tech](https://img.shields.io/badge/%E6%99%BA%E8%B0%B1AI-GLM--5.1-4129)](https://open.bigmodel.cn)

</div>

---

## 📋 目录

- [项目亮点](#项目亮点)
- [技术架构](#技术架构)
- [功能演示](#功能演示)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 文档](#api-文档)
- [安全特性](#安全特性)
- [测试](#测试)

---

## ✨ 项目亮点

### 1. RAG + Agent 智能记账（核心创新）

<img src="figure/ai-chat-demo.gif" width="520" alt="AI Chat Demo"/>

**痛点**：传统记账 APP 需要用户手动选择分类、输入金额，操作繁琐，难以坚持。

**方案**：基于 LLM Function Calling 实现对话式记账。用户只需说"今天午餐麦当劳 35 元"，AI 自动完成分类、金额提取、入库。支持一次对话识别多条账单，批量确认。

**技术细节**：
- 手写 ReAct 循环（LLM 选工具 → 执行 → 结果回传 → 最终回复），最多 3 轮工具调用
- 9 个工具：`query_bills`, `create_bill`, `get_monthly_summary`, `get_category_breakdown`, `get_trend`, `list_categories`, `scan_receipt`, `get_budget_status`, `suggest_budget`
- 混合内容路由：LLM 可返回 Markdown 或 JSON 结构化内容块（7 种类型），前端自适应渲染
- 时间锚点机制：单次请求锁定时间戳，LLM 和 OCR 共享同一时间基准

**结果**：用户记账效率提升 5 倍，分类准确率 >90%。

---

### 2. 多端统一账号体系

<table>
  <tr>
    <td align="center"><img src="figure/multi-platform-web.PNG" width="280" alt="Web 端"/></td>
    <td align="center"><img src="figure/multi-platform-wx.PNG" width="200" alt="微信小程序"/></td>
  </tr>
  <tr>
    <td align="center" style="padding-top:8px"><b>Web 端</b></td>
    <td align="center" style="padding-top:8px"><b>微信小程序</b></td>
  </tr>
</table>

**场景**：用户希望在 Web 端和小程序端都能访问自己的账单数据。

**方案**：后端统一 JWT 认证，支持用户名密码和微信 openid 两种登录方式。两端共享同一用户表、同一数据源。

**结果**：一端记账，多端实时同步。

---

### 3. 多格式账单导入 + 自动解析

<img src="figure/file-upload.PNG" width="520" alt="File Upload"/>

**场景**：用户有大量微信/支付宝/银行账单文件，需要批量导入。

**方案**：上传 CSV/Excel/PDF → 自动识别编码、表头位置、字段映射 → 关键词自动分类 → 基于交易单号或日期+金额+对方去重 → 批量入库。

**结果**：支持微信/支付宝/通用格式，1 秒解析 100+ 条交易。

---

### 4. OCR 图片识别（双引擎）

<img src="figure/ocr-demo.PNG" width="520" alt="OCR Demo"/>

**场景**：用户拍摄收据/账单截图，希望自动识别并记账。

**方案**：PaddleOCR（本地免费）+ Vision LLM（云端高精度）双引擎。优先本地识别，失败自动回退到云端。

**结果**：离线可用，识别准确率 >95%。

---

### 5. 月度预算规划 + AI 建议

<img src="figure/budget-demo.PNG" width="520" alt="Budget Demo"/>

**场景**：用户希望了解自己的消费趋势，并获得预算建议。

**方案**：预算 CRUD + 预算 vs 实际对比 + AI 基于近 3 个月历史数据生成预算建议 + 自动生成（上月消费 + 10%）。

**结果**：帮助用户合理规划月度消费，超支预警。

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    客户端层                              │
│  ┌──────────────────┐    ┌──────────────────────────┐  │
│  │   Web 前端        │    │   微信小程序 (Taro)       │  │
│  │   React 18 + Vite │    │   React 18 + ECharts     │  │
│  │   Tailwind CSS    │    │   Zustand + WXSS         │  │
│  │   recharts        │    │                          │  │
│  └────────┬─────────┘    └────────────┬─────────────┘  │
│           │   REST API + SSE          │                 │
└───────────┼────────────────────────────┼─────────────────┘
            │                            │
┌───────────▼────────────────────────────▼─────────────────┐
│              FastAPI 后端 (app/)                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  API Layer (api/v1/endpoints/)                    │    │
│  │  auth / bills / categories / budgets / statistics │    │
│  │  chat / ocr / wechat                              │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐    │
│  │  Service Layer (services/)                        │    │
│  │  BillService / CategoryService / BudgetService    │    │
│  │  StatisticsService / ChatService / OCRService     │    │
│  │  ChatSessionService / DefaultCategoryService      │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐    │
│  │  Model Layer (models/)                            │    │
│  │  User / Bill / Category / Budget / ChatSession    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ PostgreSQL  │  │  OpenAI LLM  │  │  PaddleOCR    │   │
│  └─────────────┘  └──────────────┘  └───────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| Web 框架 | FastAPI 0.115 | 高性能异步框架，自动 OpenAPI 文档 |
| ORM | SQLAlchemy 2.0 | 同步模式，连接池管理 |
| 数据库 | PostgreSQL | 支持 SQLite 开发 |
| 迁移 | Alembic | 版本化数据库迁移 |
| AI 对话 | OpenAI Function Calling | 兼容智谱/DeepSeek/Ollama |
| Web 前端 | React 18 + TypeScript + Tailwind CSS | 响应式设计 |
| 微信小程序 | Taro 3.6 + React 18 + Zustand | 跨平台编译 |
| 认证 | JWT + 微信 openid | 双模式认证 |
| 速率限制 | 滑动窗口 | IP + 用户双维度 |
| 审计日志 | 结构化 JSON | 全链路操作记录 |

---

## 🎬 功能演示

### 流水分析

<img src="figure/analysispage.png" width="520" alt="Analysis Web"/>

<details>
<summary>📱 手机端流水分析视图</summary>
<br/>
<img src="figure/analysis-page.PNG" width="180" alt="Analysis Mobile"/>
</details>

- 月度收支汇总卡片
- 收支趋势折线图（日/周/月粒度切换）
- 分类支出饼图/条状图切换
- 预算执行进度条 + 状态徽章

> 📹 视频演示：<https://github.com/user-attachments/assets/78ffcaaa-a0ce-4842-8b0c-1c02ed3ad37f>

### 账单明细

<img src="figure/bills-page-web.PNG" width="520" alt="Analysis Web"/>

<details>
<summary>📱 手机端账单明细视图</summary>
<br/>
<img src="figure/bills-page.PNG" width="180" alt="Analysis Mobile"/>
</details>

- 按月折叠卡片展示
- 关键词搜索 + 分类/日期/类型筛选
- 行内编辑 + 删除
- 文件上传导入（Web）/ 无限滚动分页（小程序）

> 📹 视频演示：<https://github.com/user-attachments/assets/6bef2222-f127-4df6-be85-ddaf0ac2c143>

### AI 对话记账

<img src="figure/chat-page-web.PNG" width="520" alt="Analysis Web"/>

<details>
<summary>📱 手机端 AI 对话视图</summary>
<br/>
<img src="figure/chat-page.PNG" width="180" alt="Analysis Mobile"/>
</details>

- SSE 流式输出，实时状态指示器
- 批量确认记账（人在回路设计）
- 5 种角色风格切换（毒舌搭子/猫咪管家/财务分析师/老铁兄弟/默认）
- OCR 图片上传识别账单
- 结构化内容块渲染（汇总卡片/表格/账单列表/提示框）

> 📹 视频演示：<https://github.com/user-attachments/assets/48ee38ce-25ae-49f5-9014-df85e9e363c1>

### 分类管理

<img src="figure/categories-page-web.PNG" width="520" alt="Analysis Web"/>

<details>
<summary>📱 手机端分类管理视图</summary>
<br/>
<img src="figure/categories-page.PNG" width="180" alt="Analysis Mobile"/>
</details>

- 卡片网格 + 图标/颜色/关键词管理
- 30 个预设图标 + 10 个预设颜色
- 关键词自动匹配（创建账单时自动分类）

> 📹 视频演示：<https://github.com/user-attachments/assets/864d9f8e-3c1d-4559-aa11-8b1fea02009a>

### 预算管理

<img src="figure/budget-demo.PNG" width="520" alt="Analysis Web"/>

<details>
<summary>📱 手机端预算管理视图</summary>
<br/>
<img src="figure/budget-page.PNG" width="180" alt="Analysis Mobile"/>
</details>

- 预算执行进度 + 状态徽章（正常/接近上限/已超支）
- 手动设置 + 智能生成（上月消费 + 10%）
- AI 预算建议（基于近 3 个月历史数据）

---

## 🚀 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- PostgreSQL（或 SQLite 开发）

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/billagent.git
cd billagent
```

### 2. 启动后端

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 DATABASE_URL、JWT_SECRET_KEY、OPENAI_API_KEY 等

# 初始化数据库
python init_db.py

# 启动服务
uvicorn app.main:app --reload
```

访问 <http://localhost:8000/docs> 查看 Swagger API 文档。

### 3. 启动 Web 前端

```bash
cd web
npm install
npm run dev
```

访问 <http://localhost:3000>

### 4. 启动微信小程序

```bash
cd taro-miniapp
npm install
npm run dev:weapp
```

使用微信开发者工具打开 `taro-miniapp/dist/` 目录。

### 5. 运行测试

```bash
pytest tests/ -v
```

---

## 📁 项目结构

```
├── web/                          # Web 前端 (React + Vite)
│   └── src/
│       ├── api/                  # Axios API 服务层 + JWT 拦截器
│       ├── types/                # TypeScript 类型定义
│       ├── components/           # 布局 + 内容块渲染器
│       └── pages/                # 6 个页面
├── taro-miniapp/                 # 微信小程序 (Taro 3.6)
│   └── src/
│       ├── pages/                # 10 个页面
│       ├── shared/
│       │   ├── api/              # Taro.request 封装
│       │   ├── components/       # 共享组件
│       │   ├── stores/           # Zustand 状态管理
│       │   ├── hooks/            # 自定义 Hooks
│       │   └── utils/            # 工具函数
│       └── app.config.ts         # 小程序配置
├── app/                          # FastAPI 后端
│   ├── api/v1/endpoints/         # 8 个路由模块
│   ├── core/                     # 数据库/认证/依赖注入
│   ├── models/                   # 5 个 ORM 模型
│   ├── schemas/                  # Pydantic 数据验证
│   ├── services/                 # 9 个业务服务
│   ├── utils/                    # 账单解析器
│   └── middleware/               # 速率限制中间件
├── alembic/                      # 数据库迁移
├── tests/                        # pytest 测试
├── init_db.py                    # 数据库初始化
└── requirements.txt              # Python 依赖
```

---

## 📡 API 文档

### 核心端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/auth/register` | 用户注册（自动创建默认分类） |
| POST | `/api/v1/auth/login` | 用户登录 |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| POST | `/api/v1/bills/` | 创建账单 |
| GET | `/api/v1/bills/` | 分页查询账单 |
| POST | `/api/v1/bills/upload` | 上传文件自动解析导入 |
| GET | `/api/v1/statistics/monthly-summary` | 月度收支汇总 |
| GET | `/api/v1/statistics/trend` | 消费趋势 |
| POST | `/api/v1/chat/stream` | AI 对话（SSE 流式） |
| POST | `/api/v1/chat/confirm` | 确认/取消待处理记账 |
| POST | `/api/v1/ocr/recognize` | OCR 图片识别 |
| POST | `/api/v1/budgets/auto-generate` | 自动生成预算 |
| GET | `/api/v1/budgets/suggest` | AI 预算建议 |

> 完整 API 文档：启动后端后访问 `/docs`（Swagger UI）

---

## 🔒 安全特性

<img src="figure/loginpage.png" width="420" alt="Login Page"/>

| 特性 | 实现 |
|---|---|
| 认证 | JWT + bcrypt 密码哈希 + 微信 openid |
| 数据隔离 | 所有数据按 user_id 隔离 |
| 速率限制 | 滑动窗口（auth: 10次/分, chat: 20次/分） |
| 审计日志 | 结构化 JSON 日志记录所有敏感操作 |
| CORS | 白名单限制 |
| 输入验证 | Pydantic 模型校验 |

---

## 🧪 测试

```bash
# 运行全部测试
pytest tests/ -v

# 覆盖率报告
pytest tests/ --cov=app --cov-report=html
```

| 测试文件 | 覆盖内容 |
|---|---|
| `test_auth.py` | 注册/登录/用户信息 |
| `test_categories.py` | 分类 CRUD + 自动匹配 |
| `test_statistics.py` | 月度汇总/分类分布/趋势 |
| `test_chat.py` | AI 对话/工具调用/会话管理 |
| `test_ocr.py` | OCR 识别/图片处理 |
| `test_bill_crud.py` | 账单增删改查 |
| `test_parsers.py` | 微信/支付宝/通用解析器 |
| `test_content_blocks.py` | 内容块解析/混合路由 |

---

## 📝 环境变量配置

```env
# 数据库
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/bill_db

# JWT
JWT_SECRET_KEY=your-super-secret-key-min-32-chars
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=43200

# LLM（支持 OpenAI / 智谱 / DeepSeek / Ollama）
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# 微信小程序（可选）
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
```

---

## 📅 更新日志

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.1 | 2026-06-13 | 安全修复：多用户隔离 + JWT + 速率限制 + 审计日志 |
| v1.2 | 2026-07-04 | 多端对齐：统一账号体系 + 预算管理 + 内容块渲染 + 注册页面 |

---
