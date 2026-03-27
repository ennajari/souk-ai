"""add customer_id to transactions

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("transactions", sa.Column("customer_id", sa.String(36), sa.ForeignKey("customers.id"), nullable=True))
    op.create_index("ix_transactions_customer_id", "transactions", ["customer_id"])


def downgrade():
    op.drop_index("ix_transactions_customer_id", "transactions")
    op.drop_column("transactions", "customer_id")
