"""Customer consent for automatic WhatsApp reminders (WhatsApp Business policy: opt-in required).

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-11-09

Additive. Defaults to false: automatic reminders stop until the merchant records the customer's consent.
"""
import sqlalchemy as sa
from alembic import op

revision = "m6n7o8p9q0r1"
down_revision = "l5m6n7o8p9q0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("whatsapp_opt_in", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("customers", "whatsapp_opt_in")
