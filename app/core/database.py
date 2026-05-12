# app/core/database.py
from app.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import logging

# 配置日志
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

print(f"使用数据库连接: {settings.DATABASE_URL}")

# 创建同步引擎
engine = create_engine(
    settings.DATABASE_URL,
    echo=True,  # 显示SQL语句
    pool_pre_ping=True,  # 连接前检查连接是否有效
    pool_recycle=3600,   # 连接1小时后回收
    pool_size=5,         # 连接池大小
    max_overflow=10,     # 最大溢出连接数
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()