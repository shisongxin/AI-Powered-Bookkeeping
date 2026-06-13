"""add_user_id_to_all_models

Revision ID: a6b03f3e2b52
Revises: 1d6ed0d05c43
Create Date: 2026-06-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'a6b03f3e2b52'
down_revision: Union[str, None] = '1d6ed0d05c43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """检查列是否存在"""
    bind = op.get_bind()
    result = bind.execute(
        text(
            f"SELECT column_name FROM information_schema.columns "
            f"WHERE table_name = '{table_name}' AND column_name = '{column_name}'"
        )
    )
    return result.fetchone() is not None


def _index_exists(table_name: str, index_name: str) -> bool:
    """检查索引是否存在"""
    bind = op.get_bind()
    result = bind.execute(
        text(
            f"SELECT indexname FROM pg_indexes "
            f"WHERE tablename = '{table_name}' AND indexname = '{index_name}'"
        )
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # 1. users 表：添加 openid / unionid，username / password_hash 改为可空
    if not _column_exists('users', 'openid'):
        op.add_column('users', sa.Column('openid', sa.String(length=64), nullable=True, comment='微信 openid'))
    if not _column_exists('users', 'unionid'):
        op.add_column('users', sa.Column('unionid', sa.String(length=64), nullable=True, comment='微信 unionid'))

    # 约束和索引
    if not _index_exists('users', 'uq_users_openid'):
        op.create_unique_constraint('uq_users_openid', 'users', ['openid'])
    if not _index_exists('users', 'uq_users_unionid'):
        op.create_unique_constraint('uq_users_unionid', 'users', ['unionid'])
    if not _index_exists('users', 'ix_users_openid'):
        op.create_index(op.f('ix_users_openid'), 'users', ['openid'], unique=True)
    if not _index_exists('users', 'ix_users_unionid'):
        op.create_index(op.f('ix_users_unionid'), 'users', ['unionid'], unique=True)
    if not _index_exists('users', 'ix_users_openid_is_active'):
        op.create_index(op.f('ix_users_openid_is_active'), 'users', ['openid', 'is_active'], unique=False)

    # username / password_hash 改为可空（小程序用户无用户名密码）
    op.alter_column('users', 'username', existing_type=sa.String(50), nullable=True)
    op.alter_column('users', 'password_hash', existing_type=sa.String(128), nullable=True)

    # 2. bills 表：添加 user_id 外键（如果不存在）
    if not _column_exists('bills', 'user_id'):
        op.add_column('bills', sa.Column('user_id', sa.Integer(), nullable=True, comment='所属用户 ID'))
    if not _index_exists('bills', 'ix_bills_user_id'):
        op.create_index(op.f('ix_bills_user_id'), 'bills', ['user_id'], unique=False)
    if not _index_exists('bills', 'ix_bills_user_transaction_date'):
        op.create_index(op.f('ix_bills_user_transaction_date'), 'bills', ['user_id', 'transaction_date'], unique=False)

    # 3. budgets 表：添加 user_id 外键
    if not _column_exists('budgets', 'user_id'):
        op.add_column('budgets', sa.Column('user_id', sa.Integer(), nullable=True, comment='所属用户 ID'))
    if not _index_exists('budgets', 'ix_budgets_user_id'):
        op.create_index(op.f('ix_budgets_user_id'), 'budgets', ['user_id'], unique=False)
    if not _index_exists('budgets', 'ix_budgets_user_year_month'):
        op.create_index(op.f('ix_budgets_user_year_month'), 'budgets', ['user_id', 'year', 'month'], unique=False)

    # 4. chat_sessions 表：添加 user_id 外键（可为空，兼容匿名会话）
    if not _column_exists('chat_sessions', 'user_id'):
        op.add_column('chat_sessions', sa.Column('user_id', sa.Integer(), nullable=True, comment='所属用户 ID'))
    if not _index_exists('chat_sessions', 'ix_chat_sessions_user_id'):
        op.create_index(op.f('ix_chat_sessions_user_id'), 'chat_sessions', ['user_id'], unique=False)
    if not _index_exists('chat_sessions', 'ix_chat_sessions_user_updated'):
        op.create_index(op.f('ix_chat_sessions_user_updated'), 'chat_sessions', ['user_id', 'updated_at'], unique=False)


def downgrade() -> None:
    # 逆序回滚
    if _index_exists('chat_sessions', 'ix_chat_sessions_user_updated'):
        op.drop_index(op.f('ix_chat_sessions_user_updated'), table_name='chat_sessions')
    if _index_exists('chat_sessions', 'ix_chat_sessions_user_id'):
        op.drop_index(op.f('ix_chat_sessions_user_id'), table_name='chat_sessions')
    if _column_exists('chat_sessions', 'user_id'):
        op.drop_column('chat_sessions', 'user_id')

    if _index_exists('budgets', 'ix_budgets_user_year_month'):
        op.drop_index(op.f('ix_budgets_user_year_month'), table_name='budgets')
    if _index_exists('budgets', 'ix_budgets_user_id'):
        op.drop_index(op.f('ix_budgets_user_id'), table_name='budgets')
    if _column_exists('budgets', 'user_id'):
        op.drop_column('budgets', 'user_id')

    if _index_exists('bills', 'ix_bills_user_transaction_date'):
        op.drop_index(op.f('ix_bills_user_transaction_date'), table_name='bills')
    if _index_exists('bills', 'ix_bills_user_id'):
        op.drop_index(op.f('ix_bills_user_id'), table_name='bills')
    if _column_exists('bills', 'user_id'):
        op.drop_column('bills', 'user_id')

    if _index_exists('users', 'ix_users_openid_is_active'):
        op.drop_index(op.f('ix_users_openid_is_active'), table_name='users')
    if _index_exists('users', 'ix_users_unionid'):
        op.drop_index(op.f('ix_users_unionid'), table_name='users')
    if _index_exists('users', 'ix_users_openid'):
        op.drop_index(op.f('ix_users_openid'), table_name='users')

    # 尝试删除约束（可能不存在）
    try:
        op.drop_constraint('uq_users_unionid', 'users', type_='unique')
    except Exception:
        pass
    try:
        op.drop_constraint('uq_users_openid', 'users', type_='unique')
    except Exception:
        pass

    if _column_exists('users', 'unionid'):
        op.drop_column('users', 'unionid')
    if _column_exists('users', 'openid'):
        op.drop_column('users', 'openid')
