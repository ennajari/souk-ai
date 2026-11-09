"""VAT rate per product, frozen on each transaction line (prices are tax-inclusive).

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-11-09

Additive: NULL = rate not set (no tax breakdown shown), so existing data is unchanged.
"""
import sqlalchemy as sa
from alembic import op

revision = "n7o8p9q0r1s2"
down_revision = "m6n7o8p9q0r1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("tax_rate", sa.Numeric(5, 2), nullable=True))
    op.add_column("transactions", sa.Column("tax_rate", sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "tax_rate")
    op.drop_column("products", "tax_rate")
