"""add lottery fields to raffles

Revision ID: d8e3f5c9a012
Revises: b7f3e4a2c891
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd8e3f5c9a012'
down_revision: Union[str, None] = 'b7f3e4a2c891'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('raffles', sa.Column('lottery_slug', sa.String(100), nullable=True))
    op.add_column('raffles', sa.Column('lottery_digits', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('raffles', 'lottery_digits')
    op.drop_column('raffles', 'lottery_slug')
