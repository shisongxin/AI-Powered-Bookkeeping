# app/config.py
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

class Settings(BaseSettings):
    # 应用基础配置
    APP_NAME: str = "BillAgent"
    DEBUG: bool = True # 开发环境设为True
    API_V1_PREFIX: str = "/api/v1"
    
    # 数据库配置 - 同步版本
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg2://postgres:697012@localhost:5432/bill_db"
    )
    
    # LLM 配置（OpenAI 兼容接口，可切换 Ollama / LM Studio / 国产模型）
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "19d299b045ee418e823d04b10b8be8c7.xblqgSBjzZAfMdgi")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://open.bigmodel.cn/api/paas/v4")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "glm-5.1")
    LLM_MAX_TOKENS: int = 1024
    LLM_TEMPERATURE: float = 0.7

    # 后续 RAG 相关配置预留
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()