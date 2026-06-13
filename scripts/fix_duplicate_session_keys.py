#!/usr/bin/env python3
"""
修复重复的 session_key 问题
删除重复的 chat_sessions 记录，只保留最新的
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings

def fix_duplicates():
    """删除重复的 session_key，只保留每个 key 的最新记录"""
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # 查找重复的 session_key
        result = db.execute(text("""
            SELECT session_key, COUNT(*) as cnt, MAX(id) as max_id
            FROM chat_sessions
            GROUP BY session_key
            HAVING COUNT(*) > 1
        """))

        duplicates = result.fetchall()

        if not duplicates:
            print("[OK] 没有发现重复的 session_key")
            return

        print(f"[INFO] 发现 {len(duplicates)} 个重复的 session_key")

        deleted_count = 0
        for session_key, count, max_id in duplicates:
            # 删除不是最新 id 的记录
            result = db.execute(text("""
                DELETE FROM chat_sessions
                WHERE session_key = :key AND id != :max_id
            """), {"key": session_key, "max_id": max_id})

            deleted = result.rowcount
            deleted_count += deleted
            print(f"  - session_key='{session_key}': 删除 {deleted} 条重复记录（保留 id={max_id}）")

        db.commit()
        print(f"\n[OK] 总共删除了 {deleted_count} 条重复记录")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] 修复失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("修复重复的 session_key")
    print("=" * 60)
    fix_duplicates()
