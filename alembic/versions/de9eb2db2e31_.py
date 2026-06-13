"""empty message

Revision ID: de9eb2db2e31
Revises: 1d6ed0d05c43, a6b03f3e2b52
Create Date: 2026-06-13 13:25:00.900974

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de9eb2db2e31'
down_revision: Union[str, None] = ('1d6ed0d05c43', 'a6b03f3e2b52')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
