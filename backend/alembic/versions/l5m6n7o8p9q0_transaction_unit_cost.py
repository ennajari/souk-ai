"""Snapshot of the product cost on each transaction (margins must not change when cost_price changes).

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-11-09

Additive: NULL for historical rows, which fall back to the product's current cost (previous behaviour).
"""
import sqlalchemy as sa
from alembic import op

revision = "l5m6n7o8p9q0"
down_revision = "k4l5m6n7o8p9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("unit_cost", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "unit_cost")
