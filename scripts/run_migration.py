#!/usr/bin/env python3
"""数据库迁移脚本 — 执行 Alembic 迁移并验证"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic.config import Config
from alembic import command
from app.config import settings
from app.core.database import engine, Base
from app.models.user import User
from app.models.bill import Bill
from app.models.budget import Budget
from app.models.chat_session import ChatSession
from app.models.category import Category


def run_migration():
    """执行数据库迁移"""
    print("=" * 60)
    print("BillAgent 数据库迁移")
    print("=" * 60)

    # 显示当前数据库 URL
    db_url = settings.DATABASE_URL
    print(f"\n数据库 URL: {db_url}")

    # 配置 Alembic
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    print("\n执行迁移...")
    try:
        # 升级到最新版本
        command.upgrade(alembic_cfg, "head")
        print("✓ 迁移完成")
        return True
    except Exception as e:
        print(f"✗ 迁移失败: {e}")
        return False


def verify_models():
    """验证模型定义与数据库表一致"""
    print("\n" + "=" * 60)
    print("验证模型定义")
    print("=" * 60)

    # 检查各模型的必要字段
    models_to_check = [
        ("User", User, ["id", "openid", "unionid", "username", "is_active"]),
        ("Bill", Bill, ["id", "user_id", "amount", "category"]),
        ("Budget", Budget, ["id", "user_id", "year", "month", "category"]),
        ("ChatSession", ChatSession, ["id", "user_id", "session_key", "messages"]),
        ("Category", Category, ["id", "name"]),
    ]

    all_ok = True
    for name, model, expected_fields in models_to_check:
        print(f"\n检查 {name} 模型...")
        table_columns = {c.name for c in model.__table__.columns}
        missing = [f for f in expected_fields if f not in table_columns]

        if missing:
            print(f"  ✗ 缺少字段: {missing}")
            all_ok = False
        else:
            print(f"  ✓ 所有必要字段存在")

    return all_ok


def create_test_data():
    """创建测试数据验证用户隔离"""
    print("\n" + "=" * 60)
    print("创建测试数据")
    print("=" * 60)

    from sqlalchemy.orm import Session

    with engine.connect() as conn:
        # 检查是否已有测试数据
        result = conn.execute("SELECT COUNT(*) FROM users")
        count = result.scalar()

        if count > 0:
            print(f"\n数据库已有 {count} 个用户，跳过测试数据创建")
            return True

        print("\n创建测试用户...")
        try:
            # 创建测试用户
            conn.execute(
                "INSERT INTO users (openid, is_active, created_at) VALUES (:openid, 1, datetime('now'))",
                {"openid": "test_openid_user1"}
            )
            conn.execute(
                "INSERT INTO users (openid, is_active, created_at) VALUES (:openid, 1, datetime('now'))",
                {"openid": "test_openid_user2"}
            )
            conn.commit()
            print("  ✓ 创建 2 个测试用户")
            return True
        except Exception as e:
            print(f"  ✗ 创建测试数据失败: {e}")
            return False


if __name__ == "__main__":
    # 执行迁移
    migration_ok = run_migration()

    # 验证模型
    models_ok = verify_models()

    print("\n" + "=" * 60)
    if migration_ok and models_ok:
        print("✓ 所有验证通过")
        sys.exit(0)
    else:
        print("✗ 部分验证失败")
        sys.exit(1)
