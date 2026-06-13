# app/services/chat_session_service.py
"""Chat 会话持久化服务 — DB 读写 + TTL 自动压缩"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.models.chat_session import ChatSession

logger = logging.getLogger(__name__)


class ChatSessionService:
    """管理聊天会话的持久化存储，支持 TTL 过期自动压缩"""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, session_key: Optional[str] = None, user_id: Optional[int] = None) -> Tuple[str, list[dict]]:
        """获取已有会话或创建新会话。
        返回 (session_key, messages_history)。
        如果会话超过 TTL，自动压缩历史记录。

        Args:
            session_key: 会话标识
            user_id: 用户 ID，用于隔离不同用户的会话
        """
        if session_key:
            q = self.db.query(ChatSession).filter(ChatSession.session_key == session_key)
            # 如果指定了 user_id，只返回该用户的会话
            if user_id is not None:
                q = q.filter(ChatSession.user_id == user_id)
            existing = q.first()
            if existing:
                # 检查 TTL 是否需要压缩
                self._maybe_compress(existing)
                return existing.session_key, existing.messages or []

        # 创建新会话（确保 session_key 唯一）
        new_key = session_key
        if not new_key:
            new_key = uuid.uuid4().hex[:16]  # 16位hex，冲突概率极低

        session = ChatSession(session_key=new_key, messages=[], user_id=user_id)
        self.db.add(session)

        try:
            self.db.commit()
            logger.info(f"新会话已创建: {new_key}, user_id={user_id}")
            return new_key, []
        except IntegrityError:
            # 唯一约束冲突，回滚并生成新的 key
            self.db.rollback()
            logger.warning(f"session_key 冲突: {new_key}，重新生成")

            for _ in range(5):
                new_key = uuid.uuid4().hex[:16]
                session = ChatSession(session_key=new_key, messages=[], user_id=user_id)
                self.db.add(session)
                try:
                    self.db.commit()
                    logger.info(f"新会话已创建（重试）: {new_key}, user_id={user_id}")
                    return new_key, []
                except IntegrityError:
                    self.db.rollback()
                    continue

            # 5次都失败，使用时间戳
            new_key = f"{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
            session = ChatSession(session_key=new_key, messages=[], user_id=user_id)
            self.db.add(session)
            self.db.commit()
            logger.info(f"新会话已创建（最终）: {new_key}, user_id={user_id}")
            return new_key, []

    def save(self, session_key: str, messages: list[dict], persona: str = "", user_id: Optional[int] = None):
        """将消息历史保存到数据库（upsert：存在则更新，不存在则创建）

        Args:
            session_key: 会话标识
            messages: 消息历史
            persona: 角色风格
            user_id: 用户 ID（创建新会话时使用）
        """
        session = (
            self.db.query(ChatSession)
            .filter(ChatSession.session_key == session_key)
            .first()
        )
        if session:
            session.messages = messages
            session.updated_at = datetime.now()
            if persona:
                session.persona = persona
        else:
            session = ChatSession(session_key=session_key, messages=messages, user_id=user_id)
            if persona:
                session.persona = persona
            self.db.add(session)
        self.db.commit()

    def _maybe_compress(self, session: ChatSession):
        """如果会话超过 TTL，压缩历史记录：保留 system prompt + 最近 N 轮对话"""
        if not session.messages or not session.updated_at:
            return

        ttl_days = settings.CHAT_SESSION_TTL_DAYS
        keep_rounds = settings.CHAT_KEEP_RECENT_ROUNDS

        now = datetime.now()
        age_days = (now - session.updated_at).days

        if age_days < ttl_days:
            return  # 未过期，无需压缩

        logger.info(f"会话 {session.session_key} 已过期 {age_days} 天（TTL={ttl_days}），压缩上下文")

        messages = session.messages
        # 保留 system prompt（第一条 role=system 的消息）
        system_msgs = [m for m in messages if m.get("role") == "system"]
        non_system = [m for m in messages if m.get("role") != "system"]

        # 只保留最近 keep_rounds 轮（每轮 = user + assistant + 可能的 tool 消息）
        recent: list[dict] = []
        round_count = 0
        for msg in reversed(non_system):
            recent.insert(0, msg)
            if msg.get("role") == "user":
                round_count += 1
            if round_count >= keep_rounds:
                break

        compressed = system_msgs + recent
        if compressed != messages:
            session.messages = compressed
            logger.info(f"会话压缩: {len(messages)} → {len(compressed)} 条消息")
            self.db.commit()

    def delete(self, session_key: str):
        """删除会话"""
        session = (
            self.db.query(ChatSession)
            .filter(ChatSession.session_key == session_key)
            .first()
        )
        if session:
            self.db.delete(session)
            self.db.commit()

    def cleanup_expired(self, max_age_days: int = 90):
        """清理超过 max_age_days 天未活动的会话（物理删除）"""
        cutoff = datetime.now() - timedelta(days=max_age_days)
        deleted = (
            self.db.query(ChatSession)
            .filter(ChatSession.updated_at < cutoff)
            .delete()
        )
        if deleted:
            self.db.commit()
            logger.info(f"清理了 {deleted} 个过期会话（>{max_age_days}天未活动）")
