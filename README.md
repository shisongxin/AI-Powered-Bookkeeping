# BillAgent — AI-Powered Bookkeeping

智能记账助手，支持多格式账单文件导入、自动分类、AI 对话、消费分析和预算规划功能。

## 技术栈

| 层 | 技术 |
|---|---|
| Web 框架 | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0（同步模式） |
| 数据库 | PostgreSQL + psycopg2 |
| 数据解析 | pandas, pdfplumber, chardet |
| 配置管理 | pydantic-settings + python-dotenv |
| 测试 | pytest + httpx |

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
│   └── category.py            # Category Pydantic 模型
├── services/
│   ├── bill_service.py        # 账单业务逻辑（创建、导入、去重、自动分类）
│   └── category_service.py    # 分类业务逻辑（CRUD + 关键词自动匹配）
├── api/v1/endpoints/
│   ├── bills.py               # 账单 CRUD + 文件上传解析
│   ├── categories.py          # 分类 CRUD（完整增删改查）
│   └── chat.py                # AI 对话接口（待集成 RAG）
└── utils/
    ├── bill_parser.py          # 通用账单解析器（Excel/CSV/PDF）
    ├── wechat_parser.py        # 微信账单专用解析器
    └── alipay_parser.py        # 支付宝账单专用解析器
tests/
├── test_parsers.py            # 解析器测试
└── test_categories.py         # 分类系统 + 自动分类测试（27 个用例）
init_db.py                     # 数据库初始化 + 种子数据
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
```

### 4. 初始化数据库

```bash
python init_db.py
```

脚本会自动创建表并种子 10 个默认分类（餐饮、交通、购物、居住、娱乐、医疗、教育、通讯、收入、其他）。

### 5. 启动服务

```bash
uvicorn app.main:app --reload
```

访问 http://localhost:8000/docs 查看 Swagger API 文档。

### 6. 运行测试

```bash
pytest tests/ -v
```

## 已实现功能

### 分类管理系统

完整的分类 CRUD，支持通过关键词自动匹配账单到对应分类。

- `POST /api/v1/categories/` — 创建分类
- `GET /api/v1/categories/` — 分类列表
- `GET /api/v1/categories/{id}` — 分类详情
- `PUT /api/v1/categories/{id}` — 更新分类
- `DELETE /api/v1/categories/{id}` — 删除分类

**自动分类机制**：每个分类维护一组关键词（逗号分隔），导入账单时自动遍历所有分类，取关键词匹配数最高的分类。若无法匹配，则回退到账单原始 `transaction_type` 或"未分类"。

### 账单文件上传 & 自动解析

`POST /api/v1/bills/upload` — 上传账单文件，自动识别格式、解析、分类、去重、入库。

- **支持格式**：CSV / Excel (.xlsx, .xls) / PDF
- **自动识别**：文件编码（UTF-8 / GBK 等）、表头行位置、字段映射
- **自动分类**：基于交易对方、商品描述等文本自动匹配分类
- **去重机制**：基于交易单号或日期+金额+交易对方组合去重
- **解析流程**：
  1. 上传文件保存为临时文件
  2. `UniversalBillParser` 自动识别文件类型和表头
  3. 逐行提取日期、金额、交易对方、收支方向等字段
  4. `CategoryService.auto_match()` 自动匹配分类
  5. 通过 `BillService.import_from_parsed_records()` 批量入库
  6. 删除临时文件

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

### 解析器

- **`UniversalBillParser`**（推荐）：自动适配各类账单，通过关键词匹配表头和字段，无需预先知道来源格式
- **`WeChatBillParser`**：微信账单专用，按微信固定格式（跳过前 16/17 行）解析
- **`AlipayBillParser`**：支付宝账单专用，按支付宝固定格式（跳过前 24 行）解析

### API 端点一览

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
| POST | `/api/v1/chat/` | AI 对话（待开发） |

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

## 计划中的功能

- [ ] **统计数据 API** — 月度收支汇总、按分类饼图数据、消费趋势
- [ ] **AI 记账对话** — 接入 LLM（RAG 模式），支持自然语言记账查询
- [ ] **OCR 图片识别** — 上传账单截图自动识别交易信息
- [ ] **语音记账** — 语音输入转文字后自动生成账单记录
- [ ] **消费趋势分析** — 基于历史账单数据生成可视化图表
- [ ] **月度预算规划** — 智能生成下月预算建议
- [ ] **数据库迁移管理** — 引入 Alembic 做版本化迁移
