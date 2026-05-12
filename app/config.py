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
    
    # 后续 RAG 相关配置预留
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()