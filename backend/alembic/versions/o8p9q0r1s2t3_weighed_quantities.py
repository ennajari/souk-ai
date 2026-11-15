"""Decimal quantities (to the gram / millilitre) so weighed goods can be sold: 1.25 kg of tomatoes.

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-11-15

Widening only: existing integer quantities keep their exact value. Downgrade rounds to the previous types.
"""
import sqlalchemy as sa
from alembic import op

revision = "o8p9q0r1s2t3"
down_revision = "n7o8p9q0r1s2"
branch_labels = None
depends_on = None

Q = sa.Numeric(12, 3)


def upgrade() -> None:
    op.alter_column("transactions", "quantity", type_=Q, existing_type=sa.Integer(), postgresql_using="quantity::numeric")
    op.alter_column("inventory", "quantity", type_=Q, existing_type=sa.Numeric(10, 2))
    for col in ("quantity_before", "quantity_change", "quantity_after"):
        op.alter_column("inventory_logs", col, type_=Q, existing_type=sa.Numeric(10, 2))


def downgrade() -> None:
    op.alter_column("transactions", "quantity", type_=sa.Integer(), existing_type=Q, postgresql_using="round(quantity)::integer")
    op.alter_column("inventory", "quantity", type_=sa.Numeric(10, 2), existing_type=Q)
    for col in ("quantity_before", "quantity_change", "quantity_after"):
        op.alter_column("inventory_logs", col, type_=sa.Numeric(10, 2), existing_type=Q)
