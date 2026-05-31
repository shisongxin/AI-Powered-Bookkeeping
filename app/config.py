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
    
    # 数据库配置 - 同步版本（请在 .env 中设置实际连接字符串）
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./billagent.db",  # 安全 fallback，生产环境请通过 .env 覆盖为 PostgreSQL
    )

    # LLM 配置（OpenAI 兼容接口，支持 OpenAI / 智谱 / DeepSeek / Ollama 等）
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    LLM_MAX_TOKENS: int = 1024
    LLM_TEMPERATURE: float = 0.7

    # 角色预设（buddy/cat/analyst/homie/custom）
    PERSONA: str = os.getenv("PERSONA", "buddy")
    PERSONA_CUSTOM: str = os.getenv("PERSONA_CUSTOM", "")

    # 会话保留天数（过期自动压缩上下文，保留 system prompt + 最近几轮）
    CHAT_SESSION_TTL_DAYS: int = int(os.getenv("CHAT_SESSION_TTL_DAYS", "7"))
    CHAT_KEEP_RECENT_ROUNDS: int = int(os.getenv("CHAT_KEEP_RECENT_ROUNDS", "5"))

    # 后续 RAG 相关配置预留
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()