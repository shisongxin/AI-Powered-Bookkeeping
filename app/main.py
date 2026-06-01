# app/main.py
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.v1.endpoints import bills, categories, chat, statistics, auth, ocr
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """应用生命周期：启动时校验配置和数据库连接"""
    warnings = []
    if not settings.DATABASE_URL:
        warnings.append("DATABASE_URL 未设置，请在 .env 中配置数据库连接字符串")
    if not settings.OPENAI_API_KEY:
        warnings.append("OPENAI_API_KEY 未设置，AI 对话功能将不可用")

    if warnings:
        logger.warning("=" * 60)
        for w in warnings:
            logger.warning(f"⚠ 配置警告: {w}")
        logger.warning("=" * 60)
    else:
        logger.info("✓ 所有必需配置已就绪")

    try:
        from app.core.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_info = settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "SQLite"
        logger.info(f"✓ 数据库连接成功 ({db_info})")
    except Exception as e:
        logger.error(f"✗ 数据库连接失败: {e}")

    yield  # 应用运行期间

    # shutdown cleanup 可在此添加


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG, lifespan=lifespan)

# 注册路由
app.include_router(bills.router, prefix=settings.API_V1_PREFIX)
app.include_router(categories.router, prefix=settings.API_V1_PREFIX)
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)
app.include_router(statistics.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(ocr.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}"}