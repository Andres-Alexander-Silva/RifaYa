"""initial_schema

Revision ID: e9cd98a2eb43
Revises:
Create Date: 2026-05-29 17:22:36.220458

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9cd98a2eb43'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users — sin dependencias
    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=30), nullable=True),
    sa.Column('role', sa.Enum('admin', 'seller', 'buyer', name='userrole'), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. raffles — depende de users; winner_ticket_id se agrega después (FK circular con tickets)
    op.create_table('raffles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('prize_description', sa.Text(), nullable=False),
    sa.Column('prize_images', sa.JSON(), nullable=True),
    sa.Column('ticket_price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('total_tickets', sa.Integer(), nullable=False),
    sa.Column('draw_date', sa.DateTime(timezone=True), nullable=False),
    sa.Column('status', sa.Enum('draft', 'active', 'closed', 'drawn', name='rafflestatus'), nullable=False),
    sa.Column('numbering_type', sa.Enum('auto', 'manual', name='numberingtype'), nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=False),
    sa.Column('created_by_id', sa.UUID(), nullable=False),
    sa.Column('winner_ticket_id', sa.UUID(), nullable=True),  # FK se añade abajo
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_raffles_slug'), 'raffles', ['slug'], unique=True)

    # 3. payments — depende de users
    op.create_table('payments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('method', sa.Enum('wompi', 'mercadopago', 'cash', 'transfer', name='paymentmethod'), nullable=False),
    sa.Column('status', sa.Enum('pending', 'confirmed', 'failed', 'refunded', name='paymentstatus'), nullable=False),
    sa.Column('gateway_reference', sa.String(length=255), nullable=True),
    sa.Column('gateway_response', sa.JSON(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('receipt_url', sa.String(length=500), nullable=True),
    sa.Column('confirmed_by_id', sa.UUID(), nullable=True),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['confirmed_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payments_gateway_reference'), 'payments', ['gateway_reference'], unique=False)

    # 4. tickets — depende de raffles y payments
    op.create_table('tickets',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('raffle_id', sa.UUID(), nullable=False),
    sa.Column('number', sa.Integer(), nullable=False),
    sa.Column('status', sa.Enum('available', 'reserved', 'paid', 'cancelled', name='ticketstatus'), nullable=False),
    sa.Column('buyer_name', sa.String(length=255), nullable=True),
    sa.Column('buyer_phone', sa.String(length=30), nullable=True),
    sa.Column('buyer_email', sa.String(length=255), nullable=True),
    sa.Column('reserved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reservation_expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('payment_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ),
    sa.ForeignKeyConstraint(['raffle_id'], ['raffles.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('raffle_id', 'number', name='uq_raffle_ticket_number')
    )
    op.create_index(op.f('ix_tickets_raffle_id'), 'tickets', ['raffle_id'], unique=False)

    # 5. Ahora que tickets existe, añadimos el FK circular de raffles.winner_ticket_id
    op.create_foreign_key(
        'fk_raffles_winner_ticket_id',
        'raffles', 'tickets',
        ['winner_ticket_id'], ['id']
    )

    # 6. draws — depende de users, raffles y tickets
    op.create_table('draws',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('raffle_id', sa.UUID(), nullable=False),
    sa.Column('winning_ticket_id', sa.UUID(), nullable=False),
    sa.Column('drawn_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('conducted_by_id', sa.UUID(), nullable=False),
    sa.Column('certificate_url', sa.String(length=500), nullable=True),
    sa.Column('algorithm', sa.String(length=50), nullable=False),
    sa.ForeignKeyConstraint(['conducted_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['raffle_id'], ['raffles.id'], ),
    sa.ForeignKeyConstraint(['winning_ticket_id'], ['tickets.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_draws_raffle_id'), 'draws', ['raffle_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_draws_raffle_id'), table_name='draws')
    op.drop_table('draws')

    # Quitar FK circular antes de borrar tickets
    op.drop_constraint('fk_raffles_winner_ticket_id', 'raffles', type_='foreignkey')

    op.drop_index(op.f('ix_tickets_raffle_id'), table_name='tickets')
    op.drop_table('tickets')

    op.drop_index(op.f('ix_payments_gateway_reference'), table_name='payments')
    op.drop_table('payments')

    op.drop_index(op.f('ix_raffles_slug'), table_name='raffles')
    op.drop_table('raffles')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

    # Borrar los tipos ENUM
    sa.Enum(name='userrole').drop(op.get_bind())
    sa.Enum(name='rafflestatus').drop(op.get_bind())
    sa.Enum(name='numberingtype').drop(op.get_bind())
    sa.Enum(name='paymentmethod').drop(op.get_bind())
    sa.Enum(name='paymentstatus').drop(op.get_bind())
    sa.Enum(name='ticketstatus').drop(op.get_bind())
