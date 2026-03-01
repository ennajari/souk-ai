"""add expiry_date to products

Revision ID: d4e5f6a7b8c9
Revises: b3f8d2a1c9e7
Create Date: 2026-03-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "b3f8d2a1c9e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("expiry_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "expiry_date")
