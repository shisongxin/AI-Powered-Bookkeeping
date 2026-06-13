#!/usr/bin/env python3
"""
清空数据库中的所有数据（用于测试）
⚠️ 警告：这是破坏性操作，将删除所有数据！
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings

def clear_database():
    """清空所有表中的数据"""
    engine = create_engine(settings.DATABASE_URL)
    connection = engine.connect()

    try:
        # 禁用外键约束（PostgreSQL）
        connection.execute(text("SET session_replication_role = 'replica';"))

        # 清空所有表（按依赖顺序）
        tables = [
            'chat_sessions',
            'bills',
            'budgets',
            'categories',
            'users',
        ]

        for table in tables:
            connection.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
            print(f"  [OK] 已清空表: {table}")

        # 重置自增 ID（PostgreSQL）
        for table in tables:
            connection.execute(text(f"ALTER SEQUENCE IF EXISTS {table}_id_seq RESTART WITH 1;"))

        # 启用外键约束
        connection.execute(text("SET session_replication_role = 'origin';"))

        connection.commit()
        print("\n[DONE] 数据库已清空")

    except Exception as e:
        connection.rollback()
        print(f"\n[ERROR] 清空失败: {e}")
        raise
    finally:
        connection.close()
        engine.dispose()

if __name__ == "__main__":
    print("=" * 60)
    print("[WARNING] 警告：即将清空数据库中的所有数据！")
    print("=" * 60)
    print("\n将清空以下表:")
    print("  - chat_sessions")
    print("  - bills")
    print("  - budgets")
    print("  - categories")
    print("  - users")
    print("\n此操作不可恢复！")

    confirm = input("\n确认清空数据库？(输入 'YES' 继续): ")

    if confirm == 'YES':
        print("\n开始清空数据库...")
        clear_database()
    else:
        print("\n已取消操作")
