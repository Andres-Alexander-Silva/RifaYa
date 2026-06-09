"""add is_visible to raffles

Revision ID: b7f3e4a2c891
Revises: e9cd98a2eb43
Create Date: 2026-06-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b7f3e4a2c891'
down_revision: Union[str, None] = 'e9cd98a2eb43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'raffles',
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default='true'),
    )


def downgrade() -> None:
    op.drop_column('raffles', 'is_visible')
